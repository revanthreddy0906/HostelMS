"""
Allocation atomicity tests -- SRS §7.2 named scenario: attempting to
over-allocate a full room must roll back cleanly, leaving Room.occupiedbeds
unchanged and creating no Allocation row.
"""
import pytest
from datetime import date

from hms.services.allocation_service import AllocationService
from hms.services.exceptions import CapacityExceededError, HMSValidationError
from hms.repositories.repos import RoomRepository, AllocationRepository
from tests.helpers import make_admin, make_hostel_and_room, make_student


def test_auto_allocate_matches_gender_and_increments_occupancy(session):
    admin = make_admin(session)
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male", capacity=2)
    student = make_student(session, admin, roll="R1", gender="Male")

    alloc_service = AllocationService(session)
    allocation = alloc_service.auto_allocate(admin, student.studentid)
    session.flush()

    room_repo = RoomRepository(session)
    refreshed_room = room_repo.get(room.roomid)
    assert refreshed_room.occupiedbeds == 1
    assert allocation.status == "Active"
    assert allocation.roomid == room.roomid


def test_manual_allocate_rejects_gender_mismatch(session):
    admin = make_admin(session)
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male", capacity=2)
    student = make_student(session, admin, roll="R2", gender="Female")

    alloc_service = AllocationService(session)
    with pytest.raises(HMSValidationError):
        alloc_service.manual_allocate(admin, student.studentid, room.roomid)


def test_over_allocation_rolls_back_cleanly(session):
    """
    Force a room to full capacity, then attempt one more allocation.
    Must raise CapacityExceededError AND leave occupiedbeds unchanged
    (no partial write survives the failed transaction).
    """
    admin = make_admin(session)
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male", capacity=1)

    student1 = make_student(session, admin, roll="R3", gender="Male")
    student2 = make_student(session, admin, roll="R4", gender="Male")

    alloc_service = AllocationService(session)
    alloc_service.manual_allocate(admin, student1.studentid, room.roomid)
    session.commit()

    room_repo = RoomRepository(session)
    occupied_before = room_repo.get(room.roomid).occupiedbeds
    assert occupied_before == 1

    with pytest.raises(CapacityExceededError):
        alloc_service.manual_allocate(admin, student2.studentid, room.roomid)
    # Simulate the caller's transaction rollback (as session_scope() does on
    # any exception raised out of the `with` block).
    session.rollback()

    # Re-query in a way that bypasses the identity map's stale cached object
    # to prove occupiedbeds truly is unchanged on the actual DB row.
    session.expire_all()
    refreshed_room = room_repo.get(room.roomid)
    assert refreshed_room.occupiedbeds == occupied_before == 1

    alloc_repo = AllocationRepository(session)
    allocations_for_student2 = [
        a for a in alloc_repo.list_all() if a.studentid == student2.studentid
    ]
    assert allocations_for_student2 == []


def test_auto_allocate_no_room_available_raises(session):
    admin = make_admin(session)
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male", capacity=1)
    student1 = make_student(session, admin, roll="R5", gender="Male")
    student2 = make_student(session, admin, roll="R6", gender="Male")

    alloc_service = AllocationService(session)
    alloc_service.auto_allocate(admin, student1.studentid)
    session.commit()

    with pytest.raises(CapacityExceededError):
        alloc_service.auto_allocate(admin, student2.studentid)
    session.rollback()


def test_room_change_transfers_allocation_atomically(session):
    admin = make_admin(session)
    hostel, room1 = make_hostel_and_room(session, admin, gendertype="Male", capacity=1)
    room_service_room2 = make_hostel_and_room(session, admin, gendertype="Male", capacity=1)
    room2 = room_service_room2[1]
    student = make_student(session, admin, roll="R7", gender="Male")

    alloc_service = AllocationService(session)
    old_alloc = alloc_service.manual_allocate(admin, student.studentid, room1.roomid)
    session.commit()

    new_alloc = alloc_service.change_room(admin, student.studentid, room2.roomid)
    session.commit()

    room_repo = RoomRepository(session)
    assert room_repo.get(room1.roomid).occupiedbeds == 0
    assert room_repo.get(room2.roomid).occupiedbeds == 1

    alloc_repo = AllocationRepository(session)
    refreshed_old = alloc_repo.get(old_alloc.allocationid)
    assert refreshed_old.status == "Transferred"
    assert refreshed_old.vacatedate is not None
    assert new_alloc.status == "Active"
