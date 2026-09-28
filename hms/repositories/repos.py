"""Concrete repositories -- one per aggregate, thin CRUD + query methods."""
from datetime import date, timedelta
from sqlalchemy import select, func

from hms.models.models import (
    Login,
    Admin,
    Student,
    Hostel,
    Room,
    Allocation,
    Fee,
    Bed,
    Setting,
    Payment,
    Settlement,
    MaintenanceRequest,
    FoodMenu,
    ACReading,
    ParentGuest,
    Announcement,
    Complaint,
    Visitor,
    Attendance,
    Leave,
    Staff,
)
from hms.repositories.base_repo import BaseRepository


class LoginRepository(BaseRepository[Login]):
    model = Login

    def get_by_username(self, username: str):
        return self.session.execute(
            select(Login).where(Login.username == username)
        ).scalar_one_or_none()


class AdminRepository(BaseRepository[Admin]):
    model = Admin

    def get_by_userid(self, userid: int):
        return self.session.execute(
            select(Admin).where(Admin.userid == userid)
        ).scalar_one_or_none()


class StudentRepository(BaseRepository[Student]):
    model = Student

    def get_by_userid(self, userid: int):
        return self.session.execute(
            select(Student).where(Student.userid == userid)
        ).scalar_one_or_none()

    def get_by_rollnumber(self, rollnumber: str):
        return self.session.execute(
            select(Student).where(Student.rollnumber == rollnumber)
        ).scalar_one_or_none()


class HostelRepository(BaseRepository[Hostel]):
    model = Hostel

    def get_by_name(self, name: str):
        return self.session.execute(
            select(Hostel).where(Hostel.hostelname == name)
        ).scalar_one_or_none()


class RoomRepository(BaseRepository[Room]):
    model = Room

    def list_by_hostel(self, hostelid: int):
        return list(
            self.session.execute(select(Room).where(Room.hostelid == hostelid)).scalars()
        )

    def find_available_room(self, hostelid: int, roomtype: str | None = None):
        """First student room in the given hostel with a free bed, optionally matching roomtype."""
        stmt = select(Room).where(
            Room.hostelid == hostelid, Room.occupiedbeds < Room.capacity, Room.purpose == "Student"
        )
        if roomtype:
            stmt = stmt.where(Room.roomtype == roomtype)
        stmt = stmt.order_by(Room.floor, Room.roomnumber)
        return self.session.execute(stmt).scalars().first()


class AllocationRepository(BaseRepository[Allocation]):
    model = Allocation

    def active_for_student(self, studentid: int):
        return self.session.execute(
            select(Allocation).where(
                Allocation.studentid == studentid, Allocation.status == "Active"
            )
        ).scalar_one_or_none()

    def list_active(self):
        return list(
            self.session.execute(select(Allocation).where(Allocation.status == "Active")).scalars()
        )

    def active_for_room(self, roomid: int):
        return list(
            self.session.execute(
                select(Allocation).where(Allocation.roomid == roomid, Allocation.status == "Active")
            ).scalars()
        )

    def active_for_bed(self, bedid: int):
        return self.session.execute(
            select(Allocation).where(Allocation.bedid == bedid, Allocation.status == "Active")
        ).scalar_one_or_none()

    def list_for_student(self, studentid: int):
        return list(
            self.session.execute(
                select(Allocation).where(Allocation.studentid == studentid).order_by(Allocation.allocationid)
            ).scalars()
        )


class BedRepository(BaseRepository[Bed]):
    model = Bed

    def list_by_room(self, roomid: int):
        return list(
            self.session.execute(select(Bed).where(Bed.roomid == roomid).order_by(Bed.bednumber)).scalars()
        )


class SettingRepository(BaseRepository[Setting]):
    model = Setting


class PaymentRepository(BaseRepository[Payment]):
    model = Payment

    def list_between(self, start, end):
        return list(
            self.session.execute(
                select(Payment).where(Payment.paidat >= start, Payment.paidat < end)
            ).scalars()
        )


class SettlementRepository(BaseRepository[Settlement]):
    model = Settlement

    def list_by_student(self, studentid: int):
        return list(
            self.session.execute(select(Settlement).where(Settlement.studentid == studentid)).scalars()
        )


class MaintenanceRepository(BaseRepository[MaintenanceRequest]):
    model = MaintenanceRequest

    def list_by_student(self, studentid: int):
        return list(
            self.session.execute(
                select(MaintenanceRequest)
                .where(MaintenanceRequest.studentid == studentid)
                .order_by(MaintenanceRequest.createdat.desc())
            ).scalars()
        )

    def list_all_ordered(self):
        return list(
            self.session.execute(select(MaintenanceRequest).order_by(MaintenanceRequest.createdat.desc())).scalars()
        )

    def count_open_for_staff(self, staffid: int):
        return self.session.execute(
            select(func.count()).select_from(MaintenanceRequest).where(
                MaintenanceRequest.assignedstaffid == staffid,
                MaintenanceRequest.status.in_(["Assigned", "In Progress"]),
            )
        ).scalar_one()


class FoodMenuRepository(BaseRepository[FoodMenu]):
    model = FoodMenu


class ACReadingRepository(BaseRepository[ACReading]):
    model = ACReading

    def list_by_room(self, roomid: int):
        return list(
            self.session.execute(
                select(ACReading).where(ACReading.roomid == roomid).order_by(ACReading.period.desc())
            ).scalars()
        )

    def latest_for_room(self, roomid: int):
        return self.session.execute(
            select(ACReading).where(ACReading.roomid == roomid).order_by(ACReading.period.desc()).limit(1)
        ).scalar_one_or_none()

    def list_all_ordered(self):
        return list(self.session.execute(select(ACReading).order_by(ACReading.period.desc())).scalars())


class ParentGuestRepository(BaseRepository[ParentGuest]):
    model = ParentGuest

    def list_all_ordered(self):
        return list(
            self.session.execute(select(ParentGuest).order_by(ParentGuest.arrivaldate.desc())).scalars()
        )

    def active_overlapping(self, roomid: int, start, end):
        return list(
            self.session.execute(
                select(ParentGuest).where(
                    ParentGuest.roomid == roomid,
                    ParentGuest.status.in_(["Booked", "Staying"]),
                    ParentGuest.arrivaldate <= end,
                    ParentGuest.departuredate >= start,
                )
            ).scalars()
        )


class AnnouncementRepository(BaseRepository[Announcement]):
    model = Announcement

    def list_recent(self, limit: int = 50):
        return list(
            self.session.execute(
                select(Announcement)
                .order_by(Announcement.pinned.desc(), Announcement.createdat.desc())
                .limit(limit)
            ).scalars()
        )


class FeeRepository(BaseRepository[Fee]):
    model = Fee

    def list_by_student(self, studentid: int):
        return list(
            self.session.execute(
                select(Fee).where(Fee.studentid == studentid).order_by(Fee.duedate.desc(), Fee.feeid.desc())
            ).scalars()
        )

    def find(self, studentid: int, billtype: str, period: str | None):
        return self.session.execute(
            select(Fee).where(Fee.studentid == studentid, Fee.billtype == billtype, Fee.period == period)
        ).scalar_one_or_none()

    def list_unpaid(self):
        return list(self.session.execute(select(Fee).where(Fee.paymentstatus != "Paid")).scalars())

    def list_by_status(self, status: str):
        return list(
            self.session.execute(select(Fee).where(Fee.paymentstatus == status)).scalars()
        )

    def list_between(self, start: date, end: date):
        return list(
            self.session.execute(
                select(Fee).where(Fee.duedate >= start, Fee.duedate <= end)
            ).scalars()
        )


class StaffRepository(BaseRepository[Staff]):
    model = Staff

    def get_by_userid(self, userid: int):
        return self.session.execute(
            select(Staff).where(Staff.userid == userid)
        ).scalar_one_or_none()

    def list_by_designation(self, designation: str):
        return list(
            self.session.execute(
                select(Staff).where(Staff.designation == designation)
            ).scalars()
        )


class ComplaintRepository(BaseRepository[Complaint]):
    model = Complaint

    def list_by_student(self, studentid: int):
        return list(
            self.session.execute(
                select(Complaint).where(Complaint.studentid == studentid)
            ).scalars()
        )

    def count_open_for_staff(self, staffid: int):
        return self.session.execute(
            select(func.count()).select_from(Complaint).where(
                Complaint.assignedstaffid == staffid,
                Complaint.status.in_(["Open", "In Progress"]),
            )
        ).scalar_one()

    def list_all_ordered(self):
        return list(
            self.session.execute(select(Complaint).order_by(Complaint.createdat.desc())).scalars()
        )


class VisitorRepository(BaseRepository[Visitor]):
    model = Visitor

    def list_active(self):
        """Visitors who have not yet checked out."""
        return list(
            self.session.execute(select(Visitor).where(Visitor.outtime.is_(None))).scalars()
        )

    def list_by_student(self, studentid: int):
        return list(
            self.session.execute(select(Visitor).where(Visitor.studentid == studentid)).scalars()
        )


class AttendanceRepository(BaseRepository[Attendance]):
    model = Attendance

    def get_for_date(self, studentid: int, on_date: date):
        return self.session.execute(
            select(Attendance).where(
                Attendance.studentid == studentid, Attendance.date == on_date
            )
        ).scalar_one_or_none()

    def recent_for_student(self, studentid: int, days: int):
        since = date.today() - timedelta(days=days)
        return list(
            self.session.execute(
                select(Attendance)
                .where(Attendance.studentid == studentid, Attendance.date >= since)
                .order_by(Attendance.date.desc())
            ).scalars()
        )

    def list_for_date(self, on_date: date):
        return list(
            self.session.execute(select(Attendance).where(Attendance.date == on_date)).scalars()
        )


class LeaveRepository(BaseRepository[Leave]):
    model = Leave

    def list_by_student(self, studentid: int):
        return list(
            self.session.execute(select(Leave).where(Leave.studentid == studentid)).scalars()
        )

    def list_by_status(self, status: str):
        return list(
            self.session.execute(select(Leave).where(Leave.status == status)).scalars()
        )
