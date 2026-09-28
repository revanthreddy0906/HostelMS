"""
AC facility and electricity billing (PG overview document §17).

1. A student (for their own room) or the admin requests AC for a room.
2. The admin approves it once installed, recording the sub-meter's starting reading.
3. Each month the admin enters the meter reading; consumption x the configured
   rate per unit is the room's bill, split equally among the room's current
   occupants as separate "AC" bills (independent of rent and deposit).
Unpaid AC bills are included in the vacating settlement.
"""
from calendar import monthrange
from datetime import date

from sqlalchemy.orm import Session

from hms.models.models import ACReading, Fee
from hms.repositories.repos import ACReadingRepository, AllocationRepository, FeeRepository, RoomRepository
from hms.services.exceptions import HMSNotFoundError, HMSPermissionError, HMSValidationError
from hms.services.fee_service import parse_period
from hms.services.rbac import CurrentUser, require_role
from hms.services.settings_service import SettingsService

BASELINE = "baseline"


class ACService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = ACReadingRepository(session)
        self.room_repo = RoomRepository(session)
        self.allocation_repo = AllocationRepository(session)
        self.fee_repo = FeeRepository(session)
        self.settings = SettingsService(session)

    def _room(self, roomid: int):
        room = self.room_repo.get(roomid)
        if room is None:
            raise HMSNotFoundError(f"Room {roomid} not found")
        if room.purpose != "Student":
            raise HMSValidationError("AC billing applies to student rooms only")
        return room

    @require_role("Student", "Admin", "Warden")
    def request_ac(self, current_user: CurrentUser, roomid: int):
        room = self._room(roomid)
        if current_user.role == "Student":
            allocation = self.allocation_repo.active_for_student(current_user.entity_id)
            if allocation is None or allocation.roomid != roomid:
                raise HMSPermissionError("Students can request AC only for their own room")
        if room.acstatus != "None":
            raise HMSValidationError(f"AC is already {room.acstatus.lower()} for room {room.roomnumber}")
        room.acstatus = "Requested"
        self.session.flush()
        return room

    @require_role("Admin")
    def approve(self, current_user: CurrentUser, roomid: int, initialreading: float):
        room = self._room(roomid)
        if room.acstatus == "Active":
            raise HMSValidationError("AC is already active in this room")
        if initialreading < 0:
            raise HMSValidationError("Meter reading cannot be negative")
        room.acstatus = "Active"
        if self.repo.latest_for_room(roomid) is None:
            self.repo.add(
                ACReading(
                    roomid=roomid, period=BASELINE, previousreading=initialreading, currentreading=initialreading,
                    rateperunit=0, totalamount=0, occupants=0,
                )
            )
        self.session.flush()
        return room

    @require_role("Admin")
    def reject_request(self, current_user: CurrentUser, roomid: int):
        room = self._room(roomid)
        if room.acstatus != "Requested":
            raise HMSValidationError("There is no pending AC request for this room")
        room.acstatus = "None"
        self.session.flush()
        return room

    @require_role("Admin")
    def record_reading(self, current_user: CurrentUser, roomid: int, period: str, currentreading: float) -> ACReading:
        year, month = parse_period(period)
        room = self._room(roomid)
        if room.acstatus != "Active":
            raise HMSValidationError("AC is not active in this room")
        if any(r.period == period for r in self.repo.list_by_room(roomid)):
            raise HMSValidationError(f"A reading for {period} is already recorded")
        previous = self.repo.latest_for_room(roomid)
        start = float(previous.currentreading) if previous else 0.0
        if currentreading < start:
            raise HMSValidationError(f"Reading must be at least the previous reading ({start:g})")
        rate = self.settings.get_float("ac_rate_per_unit")
        total = round((currentreading - start) * rate, 2)
        occupants = self.allocation_repo.active_for_room(roomid)
        reading = self.repo.add(
            ACReading(
                roomid=roomid, period=period, previousreading=start, currentreading=currentreading,
                rateperunit=rate, totalamount=total, occupants=len(occupants),
            )
        )
        if occupants and total > 0:
            share = round(total / len(occupants), 2)
            # Due on the rent due day of the following month.
            ny, nm = (year + 1, 1) if month == 12 else (year, month + 1)
            duedate = date(ny, nm, min(self.settings.get_int("rent_due_day"), monthrange(ny, nm)[1]))
            for allocation in occupants:
                if self.fee_repo.find(allocation.studentid, "AC", period) is None:
                    self.fee_repo.add(
                        Fee(studentid=allocation.studentid, billtype="AC", period=period, amountdue=share,
                            amountpaid=0, duedate=duedate, paymentstatus="Pending")
                    )
        return reading

    @require_role("Admin", "Warden")
    def list_readings(self, current_user: CurrentUser) -> list[ACReading]:
        return [r for r in self.repo.list_all_ordered() if r.period != BASELINE]

    @require_role("Admin", "Warden")
    def ac_rooms(self, current_user: CurrentUser) -> list[dict]:
        rows = []
        for room in self.room_repo.list_all():
            if room.purpose != "Student" or room.acstatus == "None":
                continue
            latest = self.repo.latest_for_room(room.roomid)
            rows.append(
                {
                    "roomid": room.roomid,
                    "roomnumber": room.roomnumber,
                    "hostelname": room.hostel.hostelname,
                    "floor": room.floor,
                    "acstatus": room.acstatus,
                    "occupants": room.occupiedbeds,
                    "lastreading": float(latest.currentreading) if latest else None,
                    "lastperiod": latest.period if latest and latest.period != BASELINE else None,
                }
            )
        return sorted(rows, key=lambda r: (r["acstatus"] != "Requested", r["hostelname"], r["floor"], r["roomnumber"]))
