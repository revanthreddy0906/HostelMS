"""
Vacating and final settlement (PG overview document §12).

1. Collect the student's pending bills (rent incl. live late fine, AC).
2. Apply the held security deposit to those dues, oldest first.
3. The admin deducts an amount (e.g. damage) with a reason from what is left.
4. Refund = deposit - dues cleared - deduction; any dues the deposit could not
   cover remain as the balance owed.
5. The allocation is closed as Vacated, freeing the bed; the settlement row keeps
   the full financial history.
"""
from datetime import date

from sqlalchemy.orm import Session

from hms.models.models import Settlement
from hms.repositories.repos import AllocationRepository, FeeRepository, RoomRepository, SettlementRepository
from hms.services.exceptions import HMSNotFoundError, HMSValidationError
from hms.services.fee_service import CENT, DEPOSIT_PERIOD, FeeService
from hms.services.rbac import CurrentUser, ensure_self_or_role, require_role


class SettlementService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = SettlementRepository(session)
        self.allocation_repo = AllocationRepository(session)
        self.fee_repo = FeeRepository(session)
        self.room_repo = RoomRepository(session)
        self.fees = FeeService(session)

    def _active_allocation(self, allocationid: int):
        allocation = self.allocation_repo.get(allocationid)
        if allocation is None:
            raise HMSNotFoundError(f"Allocation {allocationid} not found")
        if allocation.status != "Active":
            raise HMSValidationError("Only an active allocation can be vacated")
        return allocation

    def _pending_bills(self, studentid: int, as_of: date):
        bills = [
            f
            for f in self.fee_repo.list_by_student(studentid)
            if f.billtype in ("Rent", "AC") and f.paymentstatus != "Paid" and self.fees.balance_for(f, as_of) > CENT
        ]
        return sorted(bills, key=lambda f: (f.duedate, f.feeid))

    def _deposit_held(self, studentid: int) -> float:
        deposit = self.fee_repo.find(studentid, "Deposit", DEPOSIT_PERIOD)
        return float(deposit.amountpaid) if deposit else 0.0

    @require_role("Admin", "Warden")
    def preview(self, current_user: CurrentUser, allocationid: int, vacate_date: date | None = None) -> dict:
        vacate_date = vacate_date or date.today()
        allocation = self._active_allocation(allocationid)
        bills = self._pending_bills(allocation.studentid, vacate_date)
        pending = sum(self.fees.balance_for(f, vacate_date) for f in bills)
        deposit = self._deposit_held(allocation.studentid)
        covered = min(deposit, pending)
        return {
            "allocationid": allocationid,
            "studentid": allocation.studentid,
            "vacatedate": vacate_date,
            "depositheld": deposit,
            "pendingdues": round(pending, 2),
            "pendingbills": [self.fees.view(f, vacate_date) for f in bills],
            "availablefordeduction": round(deposit - covered, 2),
            "balanceowed": round(pending - covered, 2),
        }

    @require_role("Admin", "Warden")
    def settle(
        self,
        current_user: CurrentUser,
        allocationid: int,
        deduction: float = 0.0,
        reason: str | None = None,
        vacate_date: date | None = None,
    ) -> Settlement:
        vacate_date = vacate_date or date.today()
        allocation = self._active_allocation(allocationid)
        if deduction < 0:
            raise HMSValidationError("Deduction cannot be negative")
        if deduction > 0 and not (reason or "").strip():
            raise HMSValidationError("Give a reason for the deduction")

        deposit = self._deposit_held(allocation.studentid)
        bills = self._pending_bills(allocation.studentid, vacate_date)
        pending = sum(self.fees.balance_for(f, vacate_date) for f in bills)
        remaining = deposit
        for bill in bills:
            if remaining <= CENT:
                break
            amount = round(min(remaining, self.fees.balance_for(bill, vacate_date)), 2)
            self.fees.settle_from_deposit(bill, amount, vacate_date)
            remaining = round(remaining - amount, 2)
        if deduction > remaining + CENT:
            raise HMSValidationError(f"Deduction exceeds the ₹{remaining:.2f} of deposit left after clearing dues")

        refund = round(remaining - deduction, 2)
        settlement = self.repo.add(
            Settlement(
                allocationid=allocation.allocationid,
                studentid=allocation.studentid,
                vacatedate=vacate_date,
                depositheld=deposit,
                pendingdues=round(pending, 2),
                deduction=deduction,
                deductionreason=(reason or "").strip() or None,
                refund=refund,
                balanceowed=round(max(0.0, pending - (deposit - remaining)), 2),
                createdby=current_user.userid,
            )
        )

        room = self.room_repo.get(allocation.roomid)
        allocation.status = "Vacated"
        allocation.vacatedate = vacate_date
        if room is not None and room.occupiedbeds > 0:
            room.occupiedbeds -= 1
        self.session.flush()
        return settlement

    def list_for_student(self, current_user: CurrentUser, studentid: int) -> list[Settlement]:
        ensure_self_or_role(current_user, studentid, "Admin", "Warden", "Staff")
        return self.repo.list_by_student(studentid)
