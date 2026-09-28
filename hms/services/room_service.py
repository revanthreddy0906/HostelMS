"""
Hostel block, floor, room and bed management.

FR-HM-01: hostel block capacity/warden assignment/maintenance status.
FR-HM-02: admin creates hostel blocks & configures room capacities.
FR-RM-01: room records include block (hostel), floor, bed capacity, room type.

PG overview document: rooms carry a floor, a sharing type (3/4/5 Sharing or
Pentahouse) that fixes capacity and monthly rent, an AC status, and a purpose
(Student, or Parent for free parent accommodation). Each room owns one Bed row
per bed so students are allocated to a specific bed.
"""
from sqlalchemy.orm import Session

from hms.models.models import Bed, Hostel, Room
from hms.repositories.repos import AllocationRepository, BedRepository, HostelRepository, RoomRepository, StaffRepository
from hms.services.exceptions import HMSNotFoundError, HMSValidationError
from hms.services.rbac import CurrentUser, require_role
from hms.services.settings_service import SHARING_CAPACITY, SettingsService

VALID_GENDER_TYPES = {"Male", "Female", "Mixed"}
VALID_ROOM_TYPES = set(SHARING_CAPACITY)
VALID_PURPOSES = {"Student", "Parent"}


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
        self.bed_repo = BedRepository(session)
        self.allocation_repo = AllocationRepository(session)
        self.settings = SettingsService(session)

    @require_role("Admin", "Warden")
    def create_room(
        self,
        current_user: CurrentUser,
        *,
        hostelid: int,
        roomnumber: str,
        roomtype: str,
        floor: int = 1,
        capacity: int | None = None,
        purpose: str = "Student",
        monthlyrent: float | None = None,
    ) -> Room:
        if purpose not in VALID_PURPOSES:
            raise HMSValidationError(f"purpose must be one of {VALID_PURPOSES}")
        if floor < 0:
            raise HMSValidationError("floor cannot be negative")
        if purpose == "Parent":
            # Parent rooms are free; the capacity is simply the number of guest beds.
            roomtype = "Parent"
            if not capacity or capacity <= 0:
                raise HMSValidationError("Parent rooms need a positive number of beds")
            rent = 0.0
        else:
            if roomtype not in VALID_ROOM_TYPES:
                raise HMSValidationError(f"roomtype must be one of {sorted(VALID_ROOM_TYPES)}")
            fixed = SHARING_CAPACITY[roomtype]
            if fixed is not None:
                capacity = fixed
            elif not capacity or capacity <= 0:
                raise HMSValidationError("Pentahouse rooms need a positive capacity")
            if roomtype == "Pentahouse" and monthlyrent is not None:
                if monthlyrent < 0:
                    raise HMSValidationError("monthlyrent cannot be negative")
                rent = monthlyrent
            else:
                rent = self.settings.rent_for(roomtype)
        hostel = self.hostel_repo.get(hostelid)
        if hostel is None:
            raise HMSNotFoundError(f"Hostel {hostelid} not found")
        room = self.repo.add(
            Room(
                hostelid=hostelid,
                roomnumber=roomnumber,
                floor=floor,
                capacity=capacity,
                roomtype=roomtype,
                monthlyrent=rent,
                purpose=purpose,
                occupiedbeds=0,
            )
        )
        for n in range(1, capacity + 1):
            self.session.add(Bed(roomid=room.roomid, bednumber=n))
        self.session.flush()
        return room

    def list_rooms(self, hostelid: int | None = None):
        if hostelid is not None:
            return self.repo.list_by_hostel(hostelid)
        return self.repo.list_all()

    @require_role("Admin", "Warden")
    def floor_map(self, current_user: CurrentUser) -> list[dict]:
        """Hostels -> floors -> rooms -> beds with the current occupant of each bed."""
        occupant_by_bed: dict[int, tuple[int, str]] = {}
        for allocation in self.allocation_repo.list_active():
            if allocation.bedid:
                s = allocation.student
                occupant_by_bed[allocation.bedid] = (s.studentid, f"{s.firstname} {s.lastname}")
        result = []
        for hostel in self.hostel_repo.list_all():
            floors: dict[int, list[dict]] = {}
            for room in sorted(self.repo.list_by_hostel(hostel.hostelid), key=lambda r: (r.floor, r.roomnumber)):
                beds = []
                for bed in room.beds:
                    occ = occupant_by_bed.get(bed.bedid)
                    beds.append(
                        {
                            "bedid": bed.bedid,
                            "bednumber": bed.bednumber,
                            "studentid": occ[0] if occ else None,
                            "studentname": occ[1] if occ else None,
                        }
                    )
                floors.setdefault(room.floor, []).append(
                    {
                        "roomid": room.roomid,
                        "roomnumber": room.roomnumber,
                        "roomtype": room.roomtype,
                        "purpose": room.purpose,
                        "capacity": room.capacity,
                        "occupiedbeds": room.occupiedbeds,
                        "monthlyrent": float(room.monthlyrent),
                        "acstatus": room.acstatus,
                        "beds": beds,
                    }
                )
            result.append(
                {
                    "hostelid": hostel.hostelid,
                    "hostelname": hostel.hostelname,
                    "gendertype": hostel.gendertype,
                    "floors": [{"floor": f, "rooms": rooms} for f, rooms in sorted(floors.items())],
                }
            )
        return result

    def free_beds(self, roomid: int) -> list[Bed]:
        taken = {a.bedid for a in self.allocation_repo.active_for_room(roomid) if a.bedid}
        return [b for b in self.bed_repo.list_by_room(roomid) if b.bedid not in taken]

    def occupancy_report_rows(self):
        """FR-RG-02: occupancy reports -- returns per-room occupancy data."""
        rows = []
        for room in sorted(self.repo.list_all(), key=lambda r: (r.hostelid, r.floor, r.roomnumber)):
            hostel = self.hostel_repo.get(room.hostelid)
            rows.append(
                {
                    "hostel": hostel.hostelname if hostel else "",
                    "floor": room.floor,
                    "room": room.roomnumber,
                    "type": room.roomtype,
                    "purpose": room.purpose,
                    "rent": float(room.monthlyrent),
                    "capacity": room.capacity,
                    "occupied": room.occupiedbeds,
                    "free": room.capacity - room.occupiedbeds,
                }
            )
        return rows
