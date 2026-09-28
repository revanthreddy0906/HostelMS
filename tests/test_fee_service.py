from datetime import date

import pytest

from hms.services.allocation_service import AllocationService
from hms.services.exceptions import HMSValidationError
from hms.services.fee_service import FeeService
from hms.services.settings_service import SettingsService
from tests.helpers import make_admin, make_hostel_and_room, make_student, student_actor


def _housed_student(session, roll, rent=7000):
    admin = make_admin(session, username=f"admin_{roll}")
    make_hostel_and_room(session, admin, gendertype="Male", capacity=2, monthlyrent=rent)
    student = make_student(session, admin, roll=roll, gender="Male")
    AllocationService(session).auto_allocate(admin, student.studentid, date(2026, 8, 1))
    return admin, student


def _rent(fee_service, admin, period):
    return fee_service.generate_monthly_rent(admin, period)[0]


def test_allocation_raises_deposit_once(session):
    admin, student = _housed_student(session, "F0")
    fees = FeeService(session).list_fees_for_student(admin, student.studentid)
    deposits = [f for f in fees if f.billtype == "Deposit"]
    assert len(deposits) == 1 and float(deposits[0].amountdue) == 3000


def test_monthly_rent_uses_room_rent_and_due_day(session):
    admin, student = _housed_student(session, "F1", rent=6500)
    service = FeeService(session)
    bill = _rent(service, admin, "2026-12")
    assert float(bill.amountdue) == 6500
    assert bill.duedate == date(2026, 12, 3)
    assert service.generate_monthly_rent(admin, "2026-12") == []  # not billed twice


def test_payment_by_admin_is_recorded_as_cash(session):
    admin, student = _housed_student(session, "F2")
    service = FeeService(session)
    bill = _rent(service, admin, "2026-12")
    updated = service.pay_fee(admin, bill.feeid, 7000)
    assert updated.paymentstatus == "Paid"
    assert [p.method for p in updated.payments] == ["Cash"]


def test_student_online_payment_goes_through_gateway(session):
    admin, student = _housed_student(session, "F3")
    service = FeeService(session)
    bill = _rent(service, admin, "2026-12")
    updated = service.pay_fee(student_actor(student), bill.feeid, 3000)
    assert updated.paymentstatus == "Pending" and float(updated.amountpaid) == 3000
    assert updated.txnreference.startswith("MOCK-")


def test_late_fine_accrues_from_day_after_due_and_freezes_on_payment(session):
    admin, student = _housed_student(session, "F4")
    service = FeeService(session)
    bill = _rent(service, admin, "2026-09")  # due 3 Sep
    assert service.fine_for(bill, date(2026, 9, 3)) == 0
    assert service.fine_for(bill, date(2026, 9, 10)) == 350  # 7 days x ₹50, as in the document
    assert service.balance_for(bill, date(2026, 9, 10)) == 7350
    service._apply_payment(bill, 7350, "Online", "T1", date(2026, 9, 10))
    assert bill.paymentstatus == "Paid"
    assert service.fine_for(bill, date(2026, 12, 31)) == 350  # frozen after payment


def test_fine_rate_and_due_day_are_configurable(session):
    admin, student = _housed_student(session, "F5")
    SettingsService(session).update(admin, {"rent_due_day": 5, "late_fine_per_day": 20})
    service = FeeService(session)
    bill = _rent(service, admin, "2026-09")
    assert bill.duedate == date(2026, 9, 5)
    assert service.fine_for(bill, date(2026, 9, 8)) == 60


def test_cannot_overpay_or_pay_twice(session):
    admin, student = _housed_student(session, "F6")
    service = FeeService(session)
    bill = _rent(service, admin, "2026-12")
    with pytest.raises(HMSValidationError):
        service.pay_fee(admin, bill.feeid, 7001)
    service.pay_fee(admin, bill.feeid, 7000)
    with pytest.raises(HMSValidationError):
        service.pay_fee(admin, bill.feeid, 1)


def test_mark_overdue(session):
    admin, student = _housed_student(session, "F7")
    service = FeeService(session)
    _rent(service, admin, "2020-01")
    assert service.mark_overdue(admin, as_of=date(2026, 1, 1)) == 1  # the 2020 rent; the deposit is due later
