from datetime import date

from hms.services.fee_service import FeeService
from hms.services.allocation_service import AllocationService
from tests.helpers import make_admin, make_hostel_and_room, make_student


def test_fee_generation_and_payment_flow(session):
    admin = make_admin(session)
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male", capacity=2, roomtype="AC")
    student = make_student(session, admin, roll="F1", gender="Male")

    alloc_service = AllocationService(session)
    alloc_service.auto_allocate(admin, student.studentid)

    fee_service = FeeService(session)
    fee_service.set_fee_structure(admin, "AC", 40000.00, "Sem1-2026")
    fees = fee_service.generate_fees_for_active_allocations(admin, "Sem1-2026", date(2026, 12, 31))
    session.commit()

    assert len(fees) == 1
    fee = fees[0]
    assert float(fee.amountdue) == 40000.00
    assert fee.paymentstatus == "Pending"

    updated = fee_service.pay_fee(admin, fee.feeid, 40000.00)
    assert updated.paymentstatus == "Paid"
    assert updated.txnreference is not None
    assert updated.txnreference.startswith("MOCK-")


def test_partial_payment_keeps_pending(session):
    admin = make_admin(session)
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male", capacity=2, roomtype="Non-AC")
    student = make_student(session, admin, roll="F2", gender="Male")
    AllocationService(session).auto_allocate(admin, student.studentid)

    fee_service = FeeService(session)
    fee_service.set_fee_structure(admin, "Non-AC", 25000.00, "Sem1-2026")
    fees = fee_service.generate_fees_for_active_allocations(admin, "Sem1-2026", date(2026, 12, 31))
    fee = fees[0]

    updated = fee_service.pay_fee(admin, fee.feeid, 10000.00)
    assert updated.paymentstatus == "Pending"
    assert float(updated.amountpaid) == 10000.00


def test_mark_overdue(session):
    admin = make_admin(session)
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male", capacity=2, roomtype="Non-AC")
    student = make_student(session, admin, roll="F3", gender="Male")
    AllocationService(session).auto_allocate(admin, student.studentid)

    fee_service = FeeService(session)
    fee_service.set_fee_structure(admin, "Non-AC", 25000.00, "Sem1-2026")
    fee_service.generate_fees_for_active_allocations(admin, "Sem1-2026", date(2020, 1, 1))  # far past due date

    count = fee_service.mark_overdue(admin, as_of=date(2026, 1, 1))
    assert count == 1
