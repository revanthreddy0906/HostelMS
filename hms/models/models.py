"""
SQLAlchemy ORM models for the Hostel Management System.

12 core tables from the SRS (Login, Admin, Student, Hostel, Room, Allocation,
Fee, Complaint, Visitor, Attendance, Leave, Staff) plus supporting tables for
the PG features adopted from the PG overview document (beds, settings,
payments, settlements, maintenance, food menu, AC readings, parent guests,
announcements). See docs/SRS_AMBIGUITIES.md for the rationale on every
added/renamed column and table.

Columns marked "gap-fill" are additions required by the SRS prose (FR-xx-xx)
even though the literal schema table in the SRS omitted them; these are
documented in docs/TRACEABILITY_MATRIX.md and docs/SRS_AMBIGUITIES.md.
"""
from datetime import datetime, date

from sqlalchemy import (
    BigInteger,
    Boolean,
    Integer,
    String,
    Numeric,
    Date,
    DateTime,
    Text,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from hms.models.base import Base


class Login(Base):
    __tablename__ = "login"

    # BigInteger with an Integer variant for SQLite: SQLite only treats a
    # bare INTEGER PRIMARY KEY column as an alias for its autoincrementing
    # rowid, so BIGINT PRIMARY KEY (with the plain BigInteger type) silently
    # fails to autoincrement on SQLite while working fine on Postgres/MySQL.
    userid: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    passwordhash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # Student/Warden/Staff/Admin
    status: Mapped[str] = mapped_column(String(15), nullable=False, default="ACTIVE")

    __table_args__ = (
        CheckConstraint("role in ('Student','Warden','Staff','Admin')", name="ck_login_role"),
        CheckConstraint("status in ('ACTIVE','INACTIVE','LOCKED')", name="ck_login_status"),
    )


class Admin(Base):
    __tablename__ = "admin"

    adminid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    userid: Mapped[int] = mapped_column(BigInteger, ForeignKey("login.userid"), nullable=False)
    fullname: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    phonenumber: Mapped[str] = mapped_column(String(15), nullable=False)

    login: Mapped["Login"] = relationship()


class Student(Base):
    __tablename__ = "student"

    studentid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    userid: Mapped[int] = mapped_column(BigInteger, ForeignKey("login.userid"), nullable=False)
    rollnumber: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    firstname: Mapped[str] = mapped_column(String(50), nullable=False)
    lastname: Mapped[str] = mapped_column(String(50), nullable=False)
    gender: Mapped[str] = mapped_column(String(10), nullable=False)  # Male/Female/Other
    contactphone: Mapped[str] = mapped_column(String(15), nullable=False)
    guardianphone: Mapped[str] = mapped_column(String(15), nullable=False)
    dateofbirth: Mapped[date] = mapped_column(Date, nullable=False)

    # --- gap-fill columns required by FR-SM-02 prose, absent from the SRS table ---
    emergencycontact: Mapped[str | None] = mapped_column(String(15), nullable=True)
    bloodgroup: Mapped[str | None] = mapped_column(String(5), nullable=True)
    medicalhistory: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- PG overview additions (docs/SRS_AMBIGUITIES.md §PG features) ---
    email: Mapped[str | None] = mapped_column(String(100), nullable=True)
    college: Mapped[str | None] = mapped_column(String(120), nullable=True)
    course: Mapped[str | None] = mapped_column(String(80), nullable=True)
    yearofstudy: Mapped[str | None] = mapped_column(String(20), nullable=True)
    joiningdate: Mapped[date | None] = mapped_column(Date, nullable=True)
    foodpreference: Mapped[str] = mapped_column(String(10), nullable=False, default="Veg")  # Veg/Non-Veg
    photo: Mapped[str | None] = mapped_column(Text, nullable=True)  # data URL, optional

    login: Mapped["Login"] = relationship()

    __table_args__ = (CheckConstraint("foodpreference in ('Veg','Non-Veg')", name="ck_student_food"),)

    @property
    def residentstatus(self) -> str:
        """ACTIVE while an allocation is active, VACATED once they've left, NEW if never housed."""
        from sqlalchemy.orm import object_session

        statuses = {row[0] for row in object_session(self).query(Allocation.status).filter(Allocation.studentid == self.studentid)}
        if "Active" in statuses:
            return "ACTIVE"
        return "VACATED" if statuses else "NEW"


class Hostel(Base):
    __tablename__ = "hostel"

    hostelid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hostelname: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    gendertype: Mapped[str] = mapped_column(String(10), nullable=False)  # Male/Female/Mixed
    totalrooms: Mapped[int] = mapped_column(Integer, nullable=False)

    # gap-fill for FR-HM-01 (maintenance status of hostel block)
    maintenancestatus: Mapped[str | None] = mapped_column(String(20), nullable=True, default="OPERATIONAL")
    # gap-fill for FR-HM-01 (warden assignment) -- nullable FK to Staff resolved after Staff is defined
    wardenstaffid: Mapped[int | None] = mapped_column(Integer, ForeignKey("staff.staffid"), nullable=True)


class Room(Base):
    __tablename__ = "room"

    roomid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hostelid: Mapped[int] = mapped_column(Integer, ForeignKey("hostel.hostelid"), nullable=False)
    roomnumber: Mapped[str] = mapped_column(String(10), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    occupiedbeds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Holds the sharing type: '3 Sharing' / '4 Sharing' / '5 Sharing' / 'Pentahouse'
    roomtype: Mapped[str] = mapped_column(String(20), nullable=False)

    floor: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    monthlyrent: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    # AC facility lifecycle: None -> Requested -> Active
    acstatus: Mapped[str] = mapped_column(String(15), nullable=False, default="None")
    # Parent rooms are reserved for guests and never allocated to students
    purpose: Mapped[str] = mapped_column(String(10), nullable=False, default="Student")

    hostel: Mapped["Hostel"] = relationship(foreign_keys=[hostelid])
    beds: Mapped[list["Bed"]] = relationship(back_populates="room", order_by="Bed.bednumber")

    __table_args__ = (
        UniqueConstraint("hostelid", "roomnumber", name="uq_room_hostel_number"),
        CheckConstraint("occupiedbeds >= 0", name="ck_room_occupied_nonneg"),
        CheckConstraint("occupiedbeds <= capacity", name="ck_room_occupied_le_capacity"),
        CheckConstraint("acstatus in ('None','Requested','Active')", name="ck_room_acstatus"),
        CheckConstraint("purpose in ('Student','Parent')", name="ck_room_purpose"),
    )


class Bed(Base):
    __tablename__ = "bed"

    bedid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    roomid: Mapped[int] = mapped_column(Integer, ForeignKey("room.roomid"), nullable=False)
    bednumber: Mapped[int] = mapped_column(Integer, nullable=False)

    room: Mapped["Room"] = relationship(back_populates="beds")

    __table_args__ = (UniqueConstraint("roomid", "bednumber", name="uq_bed_room_number"),)


class Allocation(Base):
    __tablename__ = "allocation"

    allocationid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    studentid: Mapped[int] = mapped_column(Integer, ForeignKey("student.studentid"), nullable=False)
    roomid: Mapped[int] = mapped_column(Integer, ForeignKey("room.roomid"), nullable=False)
    allocationdate: Mapped[date] = mapped_column(Date, nullable=False)
    vacatedate: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="Active")  # Active/Vacated/Transferred
    bedid: Mapped[int | None] = mapped_column(Integer, ForeignKey("bed.bedid"), nullable=True)

    student: Mapped["Student"] = relationship()
    room: Mapped["Room"] = relationship()
    bed: Mapped["Bed | None"] = relationship()


class Setting(Base):
    """Admin-configurable values (rent due day, fine per day, deposit, sharing rents, AC rate)."""

    __tablename__ = "setting"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(String(200), nullable=False)


class Fee(Base):
    __tablename__ = "fee"

    feeid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    studentid: Mapped[int] = mapped_column(Integer, ForeignKey("student.studentid"), nullable=False)
    amountdue: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    amountpaid: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.00)
    duedate: Mapped[date] = mapped_column(Date, nullable=False)
    paymentstatus: Mapped[str] = mapped_column(String(20), nullable=False, default="Pending")
    txnreference: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Rent / Deposit / AC -- kept as separate bills so deposit and AC never mix with rent
    billtype: Mapped[str] = mapped_column(String(15), nullable=False, default="Rent")
    period: Mapped[str | None] = mapped_column(String(20), nullable=True)  # e.g. '2026-09'
    # Late fine frozen at the moment the bill is fully paid (live value is computed until then)
    latefine: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    paidon: Mapped[date | None] = mapped_column(Date, nullable=True)

    student: Mapped["Student"] = relationship()
    payments: Mapped[list["Payment"]] = relationship(back_populates="fee", order_by="Payment.paidat")

    __table_args__ = (
        CheckConstraint("billtype in ('Rent','Deposit','AC')", name="ck_fee_billtype"),
        UniqueConstraint("studentid", "billtype", "period", name="uq_fee_student_type_period"),
    )


class Payment(Base):
    """One dated payment against a bill (online, cash or deposit settlement)."""

    __tablename__ = "payment"

    paymentid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    feeid: Mapped[int] = mapped_column(Integer, ForeignKey("fee.feeid"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    paidat: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    method: Mapped[str] = mapped_column(String(15), nullable=False, default="Online")  # Online/Cash/Settlement
    txnreference: Mapped[str | None] = mapped_column(String(100), nullable=True)

    fee: Mapped["Fee"] = relationship(back_populates="payments")


class Settlement(Base):
    """Vacating settlement: pending dues and deduction taken from the deposit, and the refund."""

    __tablename__ = "settlement"

    settlementid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    allocationid: Mapped[int] = mapped_column(Integer, ForeignKey("allocation.allocationid"), nullable=False, unique=True)
    studentid: Mapped[int] = mapped_column(Integer, ForeignKey("student.studentid"), nullable=False)
    vacatedate: Mapped[date] = mapped_column(Date, nullable=False)
    depositheld: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    pendingdues: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    deduction: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    deductionreason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    refund: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    balanceowed: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    createdat: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    createdby: Mapped[int] = mapped_column(BigInteger, ForeignKey("login.userid"), nullable=False)


class Staff(Base):
    __tablename__ = "staff"

    staffid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    userid: Mapped[int] = mapped_column(BigInteger, ForeignKey("login.userid"), nullable=False)
    fullname: Mapped[str] = mapped_column(String(100), nullable=False)
    designation: Mapped[str] = mapped_column(String(50), nullable=False)  # Warden/Security/Cleaner/etc
    assignedblock: Mapped[int] = mapped_column(Integer, ForeignKey("hostel.hostelid"), nullable=False)

    login: Mapped["Login"] = relationship()


class Complaint(Base):
    __tablename__ = "complaint"

    complaintid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    studentid: Mapped[int] = mapped_column(Integer, ForeignKey("student.studentid"), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    # Pending -> Reviewed -> In Progress -> Resolved (PG overview document)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="Pending")
    createdat: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    # Kept for older rows; repair tickets are now assigned in MaintenanceRequest
    assignedstaffid: Mapped[int | None] = mapped_column(Integer, ForeignKey("staff.staffid"), nullable=True)

    # Food feedback (category Food / Mess) and anonymity
    meal: Mapped[str | None] = mapped_column(String(15), nullable=True)  # Breakfast/Lunch/Dinner
    mealdate: Mapped[date | None] = mapped_column(Date, nullable=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    isanonymous: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    student: Mapped["Student"] = relationship()
    assigned_staff: Mapped["Staff | None"] = relationship()

    __table_args__ = (CheckConstraint("rating is null or (rating between 1 and 5)", name="ck_complaint_rating"),)


class MaintenanceRequest(Base):
    """Physical repair requests, separate from complaints (FR-CM-02 auto-assignment lives here)."""

    __tablename__ = "maintenance_request"

    requestid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    studentid: Mapped[int] = mapped_column(Integer, ForeignKey("student.studentid"), nullable=False)
    roomid: Mapped[int | None] = mapped_column(Integer, ForeignKey("room.roomid"), nullable=True)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(10), nullable=False, default="Medium")
    # Pending -> Assigned -> In Progress -> Resolved, or Rejected
    status: Mapped[str] = mapped_column(String(15), nullable=False, default="Pending")
    assignedstaffid: Mapped[int | None] = mapped_column(Integer, ForeignKey("staff.staffid"), nullable=True)
    photo: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolutionnote: Mapped[str | None] = mapped_column(String(300), nullable=True)
    createdat: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updatedat: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    student: Mapped["Student"] = relationship()
    room: Mapped["Room | None"] = relationship()
    assigned_staff: Mapped["Staff | None"] = relationship()

    __table_args__ = (
        CheckConstraint("priority in ('Low','Medium','High','Emergency')", name="ck_maint_priority"),
        CheckConstraint("status in ('Pending','Assigned','In Progress','Resolved','Rejected')", name="ck_maint_status"),
    )


class FoodMenu(Base):
    """One row per weekday; lunch/dinner can carry a separate non-veg option."""

    __tablename__ = "food_menu"

    day: Mapped[str] = mapped_column(String(10), primary_key=True)  # Monday..Sunday
    breakfast: Mapped[str] = mapped_column(String(200), nullable=False)
    lunch: Mapped[str] = mapped_column(String(200), nullable=False)
    lunchnonveg: Mapped[str | None] = mapped_column(String(200), nullable=True)
    dinner: Mapped[str] = mapped_column(String(200), nullable=False)
    dinnernonveg: Mapped[str | None] = mapped_column(String(200), nullable=True)
    fryums: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class ACReading(Base):
    """Monthly AC sub-meter reading for a room; its bill is split among the room's occupants."""

    __tablename__ = "ac_reading"

    readingid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    roomid: Mapped[int] = mapped_column(Integer, ForeignKey("room.roomid"), nullable=False)
    period: Mapped[str] = mapped_column(String(20), nullable=False)  # '2026-09'
    previousreading: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currentreading: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    rateperunit: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    totalamount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    occupants: Mapped[int] = mapped_column(Integer, nullable=False)
    recordedat: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    room: Mapped["Room"] = relationship()

    __table_args__ = (
        UniqueConstraint("roomid", "period", name="uq_ac_room_period"),
        CheckConstraint("currentreading >= previousreading", name="ck_ac_reading_increasing"),
    )


class ParentGuest(Base):
    """Free parent/guardian stay in a parent-reserved room."""

    __tablename__ = "parent_guest"

    guestid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    guestname: Mapped[str] = mapped_column(String(100), nullable=False)
    relation: Mapped[str] = mapped_column(String(30), nullable=False)
    studentid: Mapped[int] = mapped_column(Integer, ForeignKey("student.studentid"), nullable=False)
    phone: Mapped[str] = mapped_column(String(15), nullable=False)
    idproof: Mapped[str] = mapped_column(String(60), nullable=False)
    roomid: Mapped[int] = mapped_column(Integer, ForeignKey("room.roomid"), nullable=False)
    arrivaldate: Mapped[date] = mapped_column(Date, nullable=False)
    departuredate: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(15), nullable=False, default="Booked")  # Booked/Staying/Departed/Cancelled

    student: Mapped["Student"] = relationship()
    room: Mapped["Room"] = relationship()

    __table_args__ = (
        CheckConstraint("departuredate >= arrivaldate", name="ck_guest_dates"),
        CheckConstraint("status in ('Booked','Staying','Departed','Cancelled')", name="ck_guest_status"),
    )


class Announcement(Base):
    __tablename__ = "announcement"

    announcementid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    createdat: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    createdby: Mapped[int] = mapped_column(BigInteger, ForeignKey("login.userid"), nullable=False)


class Visitor(Base):
    __tablename__ = "visitor"

    visitorid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    visitorname: Mapped[str] = mapped_column(String(100), nullable=False)
    studentid: Mapped[int] = mapped_column(Integer, ForeignKey("student.studentid"), nullable=False)
    relationship_: Mapped[str] = mapped_column("relationship", String(30), nullable=False)
    intime: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    outtime: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # gap-fill for FR-VM-01 contact number requirement
    contactnumber: Mapped[str | None] = mapped_column(String(15), nullable=True)

    student: Mapped["Student"] = relationship()


class Attendance(Base):
    __tablename__ = "attendance"

    attendanceid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    studentid: Mapped[int] = mapped_column(Integer, ForeignKey("student.studentid"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(15), nullable=False)  # Present/Absent/On Leave
    markedby: Mapped[int] = mapped_column(BigInteger, ForeignKey("login.userid"), nullable=False)

    student: Mapped["Student"] = relationship()

    __table_args__ = (
        UniqueConstraint("studentid", "date", name="uq_attendance_student_date"),
    )


class Leave(Base):
    """NOTE: 'leave' is a reserved word in MySQL; documented in SRS_AMBIGUITIES.md."""

    __tablename__ = "leave"

    leaveid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    studentid: Mapped[int] = mapped_column(Integer, ForeignKey("student.studentid"), nullable=False)
    startdate: Mapped[date] = mapped_column(Date, nullable=False)
    enddate: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="Pending")
    approvedby: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    # gap-fill supporting fields for the gate-pass / exit-log chain (FR-LM-03, SRS §7.3)
    gatepasscode: Mapped[str | None] = mapped_column(String(100), nullable=True)
    exitlogged: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    entrylogged: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    student: Mapped["Student"] = relationship()
