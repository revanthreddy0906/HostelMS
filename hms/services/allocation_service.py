"""
Room allocation service.

FR-RM-02: auto-allocation -- match Hostel.gendertype to Student.gender and
          pick the first room with free capacity in a matching hostel,
          atomically (capacity check + Allocation insert + Room.occupiedbeds
          increment happen inside one DB transaction; on failure the whole
          operation rolls back, leaving occupiedbeds unchanged -- see
          SRS §7.2 named scenario, tested in tests/test_allocation_service.py).
FR-RM-03: manual allocation by Admin/Warden to a specific room.

Room Change (SRS product function, no dedicated table): implemented as a new
Allocation row (status='Active') plus the old Allocation row set to
status='Transferred' with vacatedate set, inside one transaction. See
docs/SRS_AMBIGUITIES.md.
"""
from datetime import date

from sqlalchemy.orm import Session

from hms.models.models import Allocation, Room, Student, Hostel
from hms.repositories.repos import AllocationRepository, RoomRepository, StudentRepository, HostelRepository
from hms.services.exceptions import CapacityExceededError, HMSNotFoundError, HMSValidationError
from hms.services.rbac import CurrentUser, require_role


def _gender_matches(hostel_gendertype: str, student_gender: str) -> bool:
    if hostel_gendertype == "Mixed":
        return True
    return hostel_gendertype == student_gender


class AllocationService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = AllocationRepository(session)
        self.room_repo = RoomRepository(session)
        self.student_repo = StudentRepository(session)
        self.hostel_repo = HostelRepository(session)

    def _allocate_room_atomic(self, student: Student, room: Room, alloc_date: date) -> Allocation:
        """
        Core atomic operation: verify capacity, create the Allocation row, and
        increment Room.occupiedbeds -- all as part of the caller's transaction.
        Raises CapacityExceededError (leaving no partial writes) if the room
        is already full at the moment of allocation.
        """
        # Re-fetch the room within this transaction to avoid stale reads.
        fresh_room = self.room_repo.get(room.roomid)
        if fresh_room is None:
            raise HMSNotFoundError(f"Room {room.roomid} not found")
        if fresh_room.occupiedbeds >= fresh_room.capacity:
            raise CapacityExceededError(
                f"Room {fresh_room.roomnumber} is at full capacity "
                f"({fresh_room.occupiedbeds}/{fresh_room.capacity})"
            )
        allocation = Allocation(
            studentid=student.studentid,
            roomid=fresh_room.roomid,
            allocationdate=alloc_date,
            status="Active",
        )
        self.session.add(allocation)
        fresh_room.occupiedbeds += 1
        # Flush so a CHECK/UNIQUE violation at the DB level surfaces now, inside
        # the same transaction, letting the caller's rollback undo both writes.
        self.session.flush()
        return allocation

    @require_role("Admin", "Warden")
    def auto_allocate(self, current_user: CurrentUser, studentid: int, alloc_date: date | None = None) -> Allocation:
        alloc_date = alloc_date or date.today()
        student = self.student_repo.get(studentid)
        if student is None:
            raise HMSNotFoundError(f"Student {studentid} not found")
        if self.repo.active_for_student(studentid) is not None:
            raise HMSValidationError(f"Student {studentid} already has an active allocation")

        candidate_hostels = [
            h for h in self.hostel_repo.list_all() if _gender_matches(h.gendertype, student.gender)
        ]
        for hostel in candidate_hostels:
            room = self.room_repo.find_available_room(hostel.hostelid)
            if room is not None:
                return self._allocate_room_atomic(student, room, alloc_date)
        raise CapacityExceededError(
            f"No available room found for student {studentid} (gender={student.gender})"
        )

    @require_role("Admin", "Warden")
    def manual_allocate(
        self, current_user: CurrentUser, studentid: int, roomid: int, alloc_date: date | None = None
    ) -> Allocation:
        alloc_date = alloc_date or date.today()
        student = self.student_repo.get(studentid)
        if student is None:
            raise HMSNotFoundError(f"Student {studentid} not found")
        room = self.room_repo.get(roomid)
        if room is None:
            raise HMSNotFoundError(f"Room {roomid} not found")
        hostel = self.hostel_repo.get(room.hostelid)
        if hostel is not None and not _gender_matches(hostel.gendertype, student.gender):
            raise HMSValidationError(
                f"Hostel '{hostel.hostelname}' ({hostel.gendertype}) does not accept gender '{student.gender}'"
            )
        if self.repo.active_for_student(studentid) is not None:
            raise HMSValidationError(f"Student {studentid} already has an active allocation")
        return self._allocate_room_atomic(student, room, alloc_date)

    @require_role("Admin", "Warden")
    def vacate(self, current_user: CurrentUser, allocationid: int, vacate_date: date | None = None) -> Allocation:
        vacate_date = vacate_date or date.today()
        allocation = self.repo.get(allocationid)
        if allocation is None:
            raise HMSNotFoundError(f"Allocation {allocationid} not found")
        if allocation.status != "Active":
            raise HMSValidationError("Allocation is not active")
        room = self.room_repo.get(allocation.roomid)
        allocation.status = "Vacated"
        allocation.vacatedate = vacate_date
        if room is not None and room.occupiedbeds > 0:
            room.occupiedbeds -= 1
        self.session.flush()
        return allocation

    @require_role("Admin", "Warden")
    def change_room(
        self, current_user: CurrentUser, studentid: int, new_roomid: int, change_date: date | None = None
    ) -> Allocation:
        """Room Change: close current allocation as Transferred, open a new Active one, atomically."""
        change_date = change_date or date.today()
        current_allocation = self.repo.active_for_student(studentid)
        if current_allocation is None:
            raise HMSValidationError(f"Student {studentid} has no active allocation to transfer")

        student = self.student_repo.get(studentid)
        new_room = self.room_repo.get(new_roomid)
        if new_room is None:
            raise HMSNotFoundError(f"Room {new_roomid} not found")

        old_room = self.room_repo.get(current_allocation.roomid)
        current_allocation.status = "Transferred"
        current_allocation.vacatedate = change_date
        if old_room is not None and old_room.occupiedbeds > 0:
            old_room.occupiedbeds -= 1
        self.session.flush()

        new_allocation = self._allocate_room_atomic(student, new_room, change_date)
        return new_allocation
