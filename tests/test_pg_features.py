from datetime import date

import pytest

from hms.services.ac_service import ACService
from hms.services.allocation_service import AllocationService
from hms.services.announcement_service import AnnouncementService
from hms.services.exceptions import HMSPermissionError, HMSValidationError
from hms.services.fee_service import FeeService
from hms.services.maintenance_service import MaintenanceService
from hms.services.menu_service import DAYS, MenuService
from hms.services.parent_service import ParentService
from hms.services.room_service import RoomService
from hms.services.settlement_service import SettlementService
from tests.helpers import make_admin, make_hostel_and_room, make_staff, make_student, staff_actor, student_actor


def _week(fryums_days=("Wednesday", "Saturday")):
    return [
        {"day": d, "breakfast": "Idly", "lunch": "Rice + Dal", "dinner": "Chapathi", "dinnernonveg": "Chicken curry", "fryums": d in fryums_days}
        for d in DAYS
    ]


def test_menu_requires_all_days_and_exactly_two_fryums(session):
    admin = make_admin(session)
    service = MenuService(session)
    saved = service.save_week(admin, _week())
    assert [r.day for r in saved] == DAYS and sum(r.fryums for r in saved) == 2
    with pytest.raises(HMSValidationError):
        service.save_week(admin, _week(fryums_days=("Monday",)))
    with pytest.raises(HMSValidationError):
        service.save_week(admin, _week()[:6])


def test_maintenance_auto_assigns_and_follows_workflow(session):
    admin = make_admin(session)
    hostel, room = make_hostel_and_room(session, admin)
    tech = make_staff(session, admin, hostel, designation="Technician", role="Staff", username="tech")
    other = make_staff(session, admin, hostel, designation="Maintenance", role="Staff", username="maint")
    student = make_student(session, admin, roll="M1")
    AllocationService(session).auto_allocate(admin, student.studentid)
    service = MaintenanceService(session)
    req = service.create(student_actor(student), "Fan", "Noisy fan", "High")
    assert (req.status, req.assignedstaffid, req.roomid) == ("Assigned", tech.staffid, room.roomid)
    with pytest.raises(HMSPermissionError):
        service.update_status(staff_actor(other, role="Staff"), req.requestid, "In Progress")  # not assigned to them
    tech_user = staff_actor(tech, role="Staff")
    service.update_status(tech_user, req.requestid, "In Progress")
    done = service.update_status(tech_user, req.requestid, "Resolved", "Replaced capacitor")
    assert done.status == "Resolved" and done.resolutionnote == "Replaced capacitor"
    assert service.list_all(staff_actor(other, role="Staff")) == []  # staff only see their own


def test_maintenance_rejection_is_admin_only_and_needs_reason(session):
    admin = make_admin(session)
    hostel, room = make_hostel_and_room(session, admin)
    maint = make_staff(session, admin, hostel, designation="Maintenance", role="Staff", username="maint")
    student = make_student(session, admin, roll="M2")
    service = MaintenanceService(session)
    req = service.create(student_actor(student), "Door", "Door squeaks")
    with pytest.raises(HMSPermissionError):
        service.update_status(staff_actor(maint, role="Staff"), req.requestid, "Rejected", "No")
    with pytest.raises(HMSValidationError):
        service.update_status(admin, req.requestid, "Rejected")
    assert service.update_status(admin, req.requestid, "Rejected", "Not a fault").status == "Rejected"


def test_ac_bill_is_split_among_occupants_and_settled_on_vacate(session):
    admin = make_admin(session)
    hostel, room = make_hostel_and_room(session, admin, capacity=4)
    students = [make_student(session, admin, roll=f"A{i}") for i in range(4)]
    allocations = [AllocationService(session).auto_allocate(admin, s.studentid, date(2026, 8, 1)) for s in students]
    ac = ACService(session)
    with pytest.raises(HMSPermissionError):
        ac.request_ac(student_actor(make_student(session, admin, roll="A9")), room.roomid)  # not their room
    ac.request_ac(student_actor(students[0]), room.roomid)
    ac.approve(admin, room.roomid, initialreading=1200)
    reading = ac.record_reading(admin, room.roomid, "2026-09", 1400)
    assert float(reading.totalamount) == 1600 and reading.occupants == 4  # 200 units x ₹8, as in the document
    fees = FeeService(session)
    bill = next(f for f in fees.repo.list_by_student(students[0].studentid) if f.billtype == "AC")
    assert float(bill.amountdue) == 400 and fees.fine_for(bill, date(2026, 12, 31)) == 0
    with pytest.raises(HMSValidationError):
        ac.record_reading(admin, room.roomid, "2026-10", 1300)  # meter can't go backwards

    deposit = next(f for f in fees.repo.list_by_student(students[0].studentid) if f.billtype == "Deposit")
    fees._apply_payment(deposit, 3000, "Online", "DEP", date(2026, 8, 1))
    settlement = SettlementService(session).settle(admin, allocations[0].allocationid, vacate_date=date(2026, 9, 30))
    assert float(settlement.pendingdues) == 400 and float(settlement.refund) == 2600


def test_parent_stay_is_free_capacity_checked_and_room_not_allocatable(session):
    admin = make_admin(session)
    hostel, room = make_hostel_and_room(session, admin)
    parent_room = RoomService(session).create_room(
        admin, hostelid=hostel.hostelid, roomnumber="P-01", roomtype="Parent", capacity=1, purpose="Parent"
    )
    student = make_student(session, admin, roll="G1")
    service = ParentService(session)
    booking = dict(
        guestname="Ramesh", relation="Father", studentid=student.studentid, phone="900", idproof="Aadhaar",
        roomid=parent_room.roomid, arrivaldate=date(2026, 10, 5), departuredate=date(2026, 10, 7),
    )
    guest = service.book(admin, **booking)
    with pytest.raises(HMSValidationError):
        service.book(admin, **{**booking, "guestname": "Sita", "arrivaldate": date(2026, 10, 6)})  # overlaps, 1 bed
    with pytest.raises(HMSValidationError):
        service.book(admin, **{**booking, "roomid": room.roomid})  # student room
    service.set_status(admin, guest.guestid, "Staying")
    with pytest.raises(HMSValidationError):
        service.set_status(admin, guest.guestid, "Booked")
    assert service.set_status(admin, guest.guestid, "Departed").status == "Departed"


def test_announcements_are_posted_by_staff_roles_only(session):
    admin = make_admin(session)
    student = make_student(session, admin, roll="N1")
    service = AnnouncementService(session)
    service.create(admin, "Rent", "Due on the 3rd", pinned=True)
    with pytest.raises(HMSPermissionError):
        service.create(student_actor(student), "Hi", "Party tonight")
    assert [a.title for a in service.list_recent()] == ["Rent"]
