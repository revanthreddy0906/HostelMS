"""
Parent accommodation (PG overview document §18).

Rooms with purpose 'Parent' are reserved for visiting parents/guardians, are
free of charge, and are never allocated to students (enforced in
AllocationService). Bookings can't exceed a room's beds on overlapping dates.
  Status: Booked -> Staying -> Departed, or Cancelled
"""
from datetime import date

from sqlalchemy.orm import Session

from hms.models.models import ParentGuest
from hms.repositories.repos import ParentGuestRepository, RoomRepository, StudentRepository
from hms.services.exceptions import HMSNotFoundError, HMSValidationError
from hms.services.rbac import CurrentUser, ensure_self_or_role, require_role

TRANSITIONS = {"Booked": {"Staying", "Cancelled"}, "Staying": {"Departed"}}


class ParentService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = ParentGuestRepository(session)
        self.room_repo = RoomRepository(session)
        self.student_repo = StudentRepository(session)

    @require_role("Admin", "Warden")
    def list_rooms(self, current_user: CurrentUser) -> list[dict]:
        today = date.today()
        rows = []
        for room in self.room_repo.list_all():
            if room.purpose != "Parent":
                continue
            staying = [g for g in self.repo.active_overlapping(room.roomid, today, today) if g.status == "Staying"]
            rows.append(
                {
                    "roomid": room.roomid,
                    "roomnumber": room.roomnumber,
                    "hostelname": room.hostel.hostelname,
                    "floor": room.floor,
                    "capacity": room.capacity,
                    "staying": len(staying),
                }
            )
        return sorted(rows, key=lambda r: (r["hostelname"], r["roomnumber"]))

    @require_role("Admin", "Warden")
    def list_guests(self, current_user: CurrentUser) -> list[ParentGuest]:
        return self.repo.list_all_ordered()

    def list_for_student(self, current_user: CurrentUser, studentid: int) -> list[ParentGuest]:
        ensure_self_or_role(current_user, studentid, "Admin", "Warden")
        return [g for g in self.repo.list_all_ordered() if g.studentid == studentid]

    @require_role("Admin", "Warden")
    def book(
        self, current_user: CurrentUser, *, guestname: str, relation: str, studentid: int, phone: str, idproof: str,
        roomid: int, arrivaldate: date, departuredate: date,
    ) -> ParentGuest:
        room = self.room_repo.get(roomid)
        if room is None or room.purpose != "Parent":
            raise HMSValidationError("Choose a parent accommodation room")
        if self.student_repo.get(studentid) is None:
            raise HMSNotFoundError(f"Student {studentid} not found")
        if departuredate < arrivaldate:
            raise HMSValidationError("Departure must be on or after arrival")
        for label, value in (("Guest name", guestname), ("Relation", relation), ("Phone", phone), ("ID proof", idproof)):
            if not (value or "").strip():
                raise HMSValidationError(f"{label} is required")
        if len(self.repo.active_overlapping(roomid, arrivaldate, departuredate)) >= room.capacity:
            raise HMSValidationError(f"Room {room.roomnumber} is fully booked for those dates")
        return self.repo.add(
            ParentGuest(
                guestname=guestname.strip(), relation=relation.strip(), studentid=studentid, phone=phone.strip(),
                idproof=idproof.strip(), roomid=roomid, arrivaldate=arrivaldate, departuredate=departuredate, status="Booked",
            )
        )

    @require_role("Admin", "Warden")
    def set_status(self, current_user: CurrentUser, guestid: int, status: str) -> ParentGuest:
        guest = self.repo.get(guestid)
        if guest is None:
            raise HMSNotFoundError(f"Guest {guestid} not found")
        if status not in TRANSITIONS.get(guest.status, set()):
            raise HMSValidationError(f"Cannot move a {guest.status.lower()} stay to {status.lower()}")
        guest.status = status
        self.session.flush()
        return guest
