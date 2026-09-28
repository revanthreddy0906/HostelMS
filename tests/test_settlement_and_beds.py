from datetime import date

import pytest

from hms.services.allocation_service import AllocationService
from hms.services.exceptions import HMSValidationError
from hms.services.fee_service import FeeService
from hms.services.room_service import HostelService, RoomService
from hms.services.settlement_service import SettlementService
from tests.helpers import make_admin, make_hostel_and_room, make_student


def test_student_gets_a_specific_bed_and_bed_frees_on_vacate(session):
    admin = make_admin(session)
    hostel, room = make_hostel_and_room(session, admin, capacity=2)
    a = make_student(session, admin, roll="B1")
    b = make_student(session, admin, roll="B2")
    service = AllocationService(session)
    bed2 = room.beds[1]
    first = service.manual_allocate(admin, a.studentid, room.roomid, bedid=bed2.bedid)
    assert first.bedid == bed2.bedid
    with pytest.raises(HMSValidationError):
        service.manual_allocate(admin, b.studentid, room.roomid, bedid=bed2.bedid)  # bed already taken
    second = service.manual_allocate(admin, b.studentid, room.roomid)
    assert second.bedid == room.beds[0].bedid
    assert [bed.bedid for bed in RoomService(session).free_beds(room.roomid)] == []


def test_parent_rooms_are_never_allocated_to_students(session):
    admin = make_admin(session)
    hostel = HostelService(session).create_hostel(admin, hostelname="PG", gendertype="Male", totalrooms=1)
    parent_room = RoomService(session).create_room(
        admin, hostelid=hostel.hostelid, roomnumber="P-01", roomtype="Parent", capacity=2, purpose="Parent"
    )
    student = make_student(session, admin, roll="P1")
    with pytest.raises(HMSValidationError):
        AllocationService(session).manual_allocate(admin, student.studentid, parent_room.roomid)


def _vacating_student(session, rent=7000):
    admin = make_admin(session)
    hostel, room = make_hostel_and_room(session, admin, capacity=2, monthlyrent=rent)
    student = make_student(session, admin, roll="V1")
    allocation = AllocationService(session).auto_allocate(admin, student.studentid, date(2026, 8, 1))
    fees = FeeService(session)
    deposit = next(f for f in fees.repo.list_by_student(student.studentid) if f.billtype == "Deposit")
    fees._apply_payment(deposit, 3000, "Online", "DEP", date(2026, 8, 1))
    return admin, room, student, allocation, fees


def test_settlement_with_deduction_refunds_the_rest(session):
    admin, room, student, allocation, fees = _vacating_student(session)
    settlement = SettlementService(session).settle(
        admin, allocation.allocationid, deduction=1500, reason="Damaged furniture", vacate_date=date(2026, 9, 1)
    )
    assert float(settlement.refund) == 1500
    assert allocation.status == "Vacated"
    assert room.occupiedbeds == 0


def test_settlement_clears_pending_rent_and_fine_from_deposit(session):
    admin, room, student, allocation, fees = _vacating_student(session, rent=2000)
    bill = fees.generate_monthly_rent(admin, "2026-09")[0]  # due 3 Sep
    settlement = SettlementService(session).settle(admin, allocation.allocationid, vacate_date=date(2026, 9, 5))
    # ₹2,000 rent + 2 days x ₹50 fine = ₹2,100 taken from the ₹3,000 deposit
    assert float(settlement.pendingdues) == 2100
    assert float(settlement.refund) == 900
    assert bill.paymentstatus == "Paid" and float(bill.latefine) == 100


def test_deduction_needs_reason_and_cannot_exceed_deposit(session):
    admin, room, student, allocation, fees = _vacating_student(session)
    service = SettlementService(session)
    with pytest.raises(HMSValidationError):
        service.settle(admin, allocation.allocationid, deduction=500, reason="")
    with pytest.raises(HMSValidationError):
        service.settle(admin, allocation.allocationid, deduction=5000, reason="Too much")
