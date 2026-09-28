"""
Fee management service.

FR-FM-01: fee structure generation per room category (FeeStructure table).
FR-FM-02: mocked payment gateway integration for fee payment.
FR-FM-03: PDF receipt generation via reportlab on successful payment
          (see hms/reports/pdf_reports.py:generate_receipt).
"""
from datetime import date

from sqlalchemy.orm import Session

from hms.models.models import Fee, FeeStructure
from hms.repositories.repos import FeeRepository, FeeStructureRepository, AllocationRepository, RoomRepository
from hms.services.exceptions import HMSNotFoundError, HMSValidationError
from hms.services.payment_service import PaymentGatewayService, default_payment_service
from hms.services.rbac import CurrentUser, ensure_self_or_role, require_role


class FeeService:
    def __init__(self, session: Session, payment_service: PaymentGatewayService | None = None):
        self.session = session
        self.repo = FeeRepository(session)
        self.structure_repo = FeeStructureRepository(session)
        self.allocation_repo = AllocationRepository(session)
        self.room_repo = RoomRepository(session)
        self.payment_service = payment_service or default_payment_service

    @require_role("Admin")
    def set_fee_structure(self, current_user: CurrentUser, roomtype: str, amount: float, semester: str) -> FeeStructure:
        existing = self.structure_repo.get(roomtype, semester)
        if existing:
            existing.amount = amount
            self.session.flush()
            return existing
        fs = FeeStructure(roomtype=roomtype, amount=amount, effective_semester=semester)
        return self.structure_repo.add(fs)

    @require_role("Admin")
    def generate_fees_for_active_allocations(
        self, current_user: CurrentUser, semester: str, duedate: date
    ) -> list[Fee]:
        """Generates one Fee row per active allocation, priced by the allocated room's type."""
        created = []
        for allocation in self.allocation_repo.list_active():
            room = self.room_repo.get(allocation.roomid)
            if room is None:
                continue
            structure = self.structure_repo.get(room.roomtype, semester)
            if structure is None:
                continue
            fee = Fee(
                studentid=allocation.studentid,
                amountdue=structure.amount,
                amountpaid=0.00,
                duedate=duedate,
                paymentstatus="Pending",
            )
            self.session.add(fee)
            created.append(fee)
        self.session.flush()
        return created

    def list_fees_for_student(self, current_user: CurrentUser, studentid: int) -> list[Fee]:
        ensure_self_or_role(current_user, studentid, "Staff", "Admin")
        return self.repo.list_by_student(studentid)

    @require_role("Student")
    def list_my_fees(self, current_user: CurrentUser) -> list[Fee]:
        return self.repo.list_by_student(current_user.entity_id)

    def get_fee_for_receipt(self, current_user: CurrentUser, feeid: int) -> Fee:
        fee = self.repo.get(feeid)
        if fee is None:
            raise HMSNotFoundError(f"Fee {feeid} not found")
        ensure_self_or_role(current_user, fee.studentid, "Staff", "Admin")
        return fee

    @require_role("Admin", "Staff", "Student")
    def pay_fee(self, current_user: CurrentUser, feeid: int, amount: float) -> Fee:
        fee = self.repo.get(feeid)
        if fee is None:
            raise HMSNotFoundError(f"Fee {feeid} not found")
        if amount <= 0:
            raise HMSValidationError("Payment amount must be positive")
        result = self.payment_service.charge(amount, payer_reference=f"fee:{feeid}")
        if not result.success:
            raise HMSValidationError(f"Payment failed: {result.message}")
        fee.amountpaid = float(fee.amountpaid) + amount
        fee.txnreference = result.txn_reference
        if float(fee.amountpaid) >= float(fee.amountdue):
            fee.paymentstatus = "Paid"
        else:
            fee.paymentstatus = "Pending"
        self.session.flush()
        return fee

    @require_role("Admin", "Staff")
    def mark_overdue(self, current_user: CurrentUser, as_of: date | None = None) -> int:
        as_of = as_of or date.today()
        count = 0
        for fee in self.repo.list_by_status("Pending"):
            if fee.duedate < as_of:
                fee.paymentstatus = "Overdue"
                count += 1
        self.session.flush()
        return count
