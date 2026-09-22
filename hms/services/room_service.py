"""
Hostel block & room management.

FR-HM-01: hostel block capacity/warden assignment/maintenance status.
FR-HM-02: admin creates hostel blocks & configures room capacities.
FR-RM-01: room records include block (hostel), bed capacity, room type.
"""
from sqlalchemy.orm import Session

from hms.models.models import Hostel, Room
from hms.repositories.repos import HostelRepository, RoomRepository, StaffRepository
from hms.services.exceptions import HMSValidationError, HMSNotFoundError
from hms.services.rbac import CurrentUser, require_role

VALID_GENDER_TYPES = {"Male", "Female", "Mixed"}
VALID_ROOM_TYPES = {"AC", "Non-AC", "Deluxe"}


class HostelService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = HostelRepository(session)
        self.staff_repo = StaffRepository(session)

    @require_role("Admin")
    def create_hostel(
        self, current_user: CurrentUser, *, hostelname: str, gendertype: str, totalrooms: int,
        maintenancestatus: str = "OPERATIONAL", wardenstaffid: int | None = None,
    ) -> Hostel:
        if gendertype not in VALID_GENDER_TYPES:
            raise HMSValidationError(f"gendertype must be one of {VALID_GENDER_TYPES}")
        if self.repo.get_by_name(hostelname) is not None:
            raise HMSValidationError(f"Hostel '{hostelname}' already exists")
        hostel = Hostel(
            hostelname=hostelname,
            gendertype=gendertype,
            totalrooms=totalrooms,
            maintenancestatus=maintenancestatus,
            wardenstaffid=wardenstaffid,
        )
        return self.repo.add(hostel)

    @require_role("Admin")
    def assign_warden(self, current_user: CurrentUser, hostelid: int, staffid: int) -> Hostel:
        hostel = self.repo.get(hostelid)
        if hostel is None:
            raise HMSNotFoundError(f"Hostel {hostelid} not found")
        staff = self.staff_repo.get(staffid)
        if staff is None:
            raise HMSNotFoundError(f"Staff {staffid} not found")
        hostel.wardenstaffid = staffid
        self.session.flush()
        return hostel

    @require_role("Admin")
    def set_maintenance_status(self, current_user: CurrentUser, hostelid: int, status: str) -> Hostel:
        hostel = self.repo.get(hostelid)
        if hostel is None:
            raise HMSNotFoundError(f"Hostel {hostelid} not found")
        hostel.maintenancestatus = status
        self.session.flush()
        return hostel

    def list_hostels(self):
        return self.repo.list_all()


class RoomService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = RoomRepository(session)
        self.hostel_repo = HostelRepository(session)

    @require_role("Admin", "Warden")
    def create_room(
        self, current_user: CurrentUser, *, hostelid: int, roomnumber: str, capacity: int, roomtype: str
    ) -> Room:
        if roomtype not in VALID_ROOM_TYPES:
            raise HMSValidationError(f"roomtype must be one of {VALID_ROOM_TYPES}")
        if capacity <= 0:
            raise HMSValidationError("capacity must be positive")
        hostel = self.hostel_repo.get(hostelid)
        if hostel is None:
            raise HMSNotFoundError(f"Hostel {hostelid} not found")
        room = Room(hostelid=hostelid, roomnumber=roomnumber, capacity=capacity, roomtype=roomtype, occupiedbeds=0)
        return self.repo.add(room)

    def list_rooms(self, hostelid: int | None = None):
        if hostelid is not None:
            return self.repo.list_by_hostel(hostelid)
        return self.repo.list_all()

    def occupancy_report_rows(self):
        """FR-RG-02: occupancy reports -- returns per-room occupancy data."""
        rows = []
        for room in self.repo.list_all():
            hostel = self.hostel_repo.get(room.hostelid)
            rows.append(
                {
                    "hostel": hostel.hostelname if hostel else "",
                    "room": room.roomnumber,
                    "type": room.roomtype,
                    "capacity": room.capacity,
                    "occupied": room.occupiedbeds,
                    "free": room.capacity - room.occupiedbeds,
                }
            )
        return rows
