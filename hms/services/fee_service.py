"""
Fee management service.

Adopted from the PG overview document (replaces FR-FM-01's semester fee
structures; recorded in docs/SRS_AMBIGUITIES.md):
  - one Rent bill per student per month, priced by the room's monthly rent and
    due on the configured day (default the 3rd);
  - a separate Deposit bill (default ₹3,000) raised once per student at allocation;
  - AC bills raised by the AC billing service;
  - a late fine of N/day (default ₹50) on Rent bills from the day after the due
    date until the bill is fully paid, then frozen and stored in Fee.latefine;
  - every payment is its own Payment row (payment history).
FR-FM-02: mocked payment gateway for online payments.
FR-FM-03: PDF receipt generation via reportlab (hms/reports/pdf_reports.py).
"""
from calendar import monthrange
from datetime import date, datetime

from sqlalchemy.orm import Session

from hms.models.models import Fee, Payment
from hms.repositories.repos import AllocationRepository, FeeRepository, PaymentRepository, RoomRepository
from hms.services.exceptions import HMSNotFoundError, HMSValidationError
from hms.services.payment_service import PaymentGatewayService, default_payment_service
from hms.services.rbac import CurrentUser, ensure_self_or_role, require_role
from hms.services.settings_service import SettingsService

DEPOSIT_PERIOD = "deposit"
CENT = 0.005


def parse_period(period: str) -> tuple[int, int]:
    try:
        year, month = (int(p) for p in period.split("-"))
        date(year, month, 1)
    except (ValueError, TypeError):
        raise HMSValidationError("period must look like YYYY-MM")
    return year, month


class FeeService:
    def __init__(self, session: Session, payment_service: PaymentGatewayService | None = None):
        self.session = session
        self.repo = FeeRepository(session)
        self.payment_repo = PaymentRepository(session)
        self.allocation_repo = AllocationRepository(session)
        self.room_repo = RoomRepository(session)
        self.settings = SettingsService(session)
        self.payment_service = payment_service or default_payment_service

    # --- amounts -------------------------------------------------------------------------

    def fine_for(self, fee: Fee, as_of: date | None = None) -> float:
        """Late fine: frozen once paid; otherwise days past due x daily rate (Rent bills only)."""
        if fee.billtype != "Rent":
            return 0.0
        if fee.paymentstatus == "Paid":
            return float(fee.latefine)
        as_of = as_of or date.today()
        late_days = (as_of - fee.duedate).days
        if late_days <= 0:
            return 0.0
        return late_days * self.settings.get_float("late_fine_per_day")

    def balance_for(self, fee: Fee, as_of: date | None = None) -> float:
        return max(0.0, float(fee.amountdue) + self.fine_for(fee, as_of) - float(fee.amountpaid))

    def view(self, fee: Fee, as_of: date | None = None) -> dict:
        """Bill as the API returns it, including the live late fine and balance."""
        as_of = as_of or date.today()
        fine = self.fine_for(fee, as_of)
        return {
            "feeid": fee.feeid,
            "studentid": fee.studentid,
            "billtype": fee.billtype,
            "period": fee.period if fee.period != DEPOSIT_PERIOD else None,
            "amountdue": float(fee.amountdue),
            "amountpaid": float(fee.amountpaid),
            "duedate": fee.duedate,
            "paymentstatus": fee.paymentstatus,
            "txnreference": fee.txnreference,
            "latefine": fine,
            "latedays": max(0, (as_of - fee.duedate).days) if fee.billtype == "Rent" and fee.paymentstatus != "Paid" else None,
            "totalpayable": float(fee.amountdue) + fine,
            "balance": self.balance_for(fee, as_of),
            "paidon": fee.paidon,
        }

    # --- bill creation -------------------------------------------------------------------

    def ensure_deposit(self, studentid: int, raised_on: date) -> Fee | None:
        """Raise the one-time security deposit bill if the student has none yet."""
        if self.repo.find(studentid, "Deposit", DEPOSIT_PERIOD) is not None:
            return None
        amount = self.settings.get_float("security_deposit")
        return self.repo.add(
            Fee(
                studentid=studentid,
                billtype="Deposit",
                period=DEPOSIT_PERIOD,
                amountdue=amount,
                amountpaid=0,
                duedate=raised_on,
                paymentstatus="Paid" if amount == 0 else "Pending",
            )
        )

    @require_role("Admin")
    def generate_monthly_rent(self, current_user: CurrentUser, period: str) -> list[Fee]:
        """One Rent bill per active student allocation for the month; skips bills that already exist."""
        year, month = parse_period(period)
        due_day = min(self.settings.get_int("rent_due_day"), monthrange(year, month)[1])
        duedate = date(year, month, due_day)
        created = []
        for allocation in self.allocation_repo.list_active():
            room = self.room_repo.get(allocation.roomid)
            if room is None or room.purpose != "Student":
                continue
            if self.repo.find(allocation.studentid, "Rent", period) is not None:
                continue
            created.append(
                self.repo.add(
                    Fee(
                        studentid=allocation.studentid,
                        billtype="Rent",
                        period=period,
                        amountdue=float(room.monthlyrent),
                        amountpaid=0,
                        duedate=duedate,
                        paymentstatus="Pending",
                    )
                )
            )
        return created

    # --- reads ---------------------------------------------------------------------------

    def list_fees_for_student(self, current_user: CurrentUser, studentid: int) -> list[Fee]:
        ensure_self_or_role(current_user, studentid, "Staff", "Admin")
        return self.repo.list_by_student(studentid)

    @require_role("Student")
    def list_my_fees(self, current_user: CurrentUser) -> list[Fee]:
        return self.repo.list_by_student(current_user.entity_id)

    def list_payments_for_student(self, current_user: CurrentUser, studentid: int) -> list[Payment]:
        ensure_self_or_role(current_user, studentid, "Staff", "Admin")
        payments = [p for f in self.repo.list_by_student(studentid) for p in f.payments]
        return sorted(payments, key=lambda p: p.paidat, reverse=True)

    def get_fee_for_receipt(self, current_user: CurrentUser, feeid: int) -> Fee:
        fee = self.repo.get(feeid)
        if fee is None:
            raise HMSNotFoundError(f"Fee {feeid} not found")
        ensure_self_or_role(current_user, fee.studentid, "Staff", "Admin")
        return fee

    @require_role("Admin", "Staff")
    def summary(self, current_user: CurrentUser) -> dict:
        """Totals for the finance overview: outstanding by type and this month's collections."""
        today = date.today()
        outstanding = {"Rent": 0.0, "Deposit": 0.0, "AC": 0.0, "fines": 0.0}
        overdue_bills = 0
        for fee in self.repo.list_unpaid():
            outstanding[fee.billtype] += max(0.0, float(fee.amountdue) - float(fee.amountpaid))
            fine = self.fine_for(fee, today)
            outstanding["fines"] += fine
            if fine > 0:
                overdue_bills += 1
        month_start = datetime(today.year, today.month, 1)
        next_month = datetime(today.year + (today.month == 12), today.month % 12 + 1, 1)
        collected = sum(float(p.amount) for p in self.payment_repo.list_between(month_start, next_month) if p.method != "Settlement")
        return {"outstanding": outstanding, "overdue_bills": overdue_bills, "collected_this_month": collected}

    # --- payments ------------------------------------------------------------------------

    def _apply_payment(self, fee: Fee, amount: float, method: str, reference: str | None, on: date) -> Payment:
        # Backdated payments (e.g. seed data, settlement on a past vacate date) are stamped on that day.
        paidat = datetime.utcnow() if on >= date.today() else datetime(on.year, on.month, on.day, 5, 0)
        payment = self.payment_repo.add(
            Payment(feeid=fee.feeid, amount=amount, method=method, txnreference=reference, paidat=paidat)
        )
        fee.amountpaid = round(float(fee.amountpaid) + amount, 2)
        fee.txnreference = reference or fee.txnreference
        if self.balance_for(fee, on) <= CENT:
            # Freeze the fine at the moment the bill is cleared so it stops increasing.
            fee.latefine = self.fine_for(fee, on)
            fee.paymentstatus = "Paid"
            fee.paidon = on
        elif fee.paymentstatus == "Paid":
            fee.paymentstatus = "Pending"
        self.session.flush()
        return payment

    @require_role("Admin", "Staff", "Student")
    def pay_fee(self, current_user: CurrentUser, feeid: int, amount: float) -> Fee:
        """Students pay online through the (mock) gateway; Admin/Staff record a cash payment."""
        fee = self.repo.get(feeid)
        if fee is None:
            raise HMSNotFoundError(f"Fee {feeid} not found")
        ensure_self_or_role(current_user, fee.studentid, "Staff", "Admin")
        if fee.paymentstatus == "Paid":
            raise HMSValidationError("This bill is already paid")
        if amount <= 0:
            raise HMSValidationError("Payment amount must be positive")
        today = date.today()
        balance = self.balance_for(fee, today)
        if amount > balance + CENT:
            raise HMSValidationError(f"Payment exceeds the outstanding balance of {balance:.2f}")
        if current_user.role == "Student":
            result = self.payment_service.charge(amount, payer_reference=f"fee:{feeid}")
            if not result.success:
                raise HMSValidationError(f"Payment failed: {result.message}")
            method, reference = "Online", result.txn_reference
        else:
            method, reference = "Cash", f"CASH-{feeid}-{datetime.utcnow():%Y%m%d%H%M%S}"
        self._apply_payment(fee, amount, method, reference, today)
        return fee

    def settle_from_deposit(self, fee: Fee, amount: float, on: date) -> None:
        """Used by vacating settlement to clear dues from the held deposit."""
        self._apply_payment(fee, amount, "Settlement", f"SETTLEMENT-{fee.feeid}", on)

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
