"""
SQLAlchemy ORM models for the Hostel Management System.

12 core tables from the SRS (Login, Admin, Student, Hostel, Room, Allocation,
Fee, Complaint, Visitor, Attendance, Leave, Staff) plus one small supporting
table, FeeStructure, used to resolve FR-FM-01 (fee structure generation per
room category) without hardcoding amounts in code. See
docs/SRS_AMBIGUITIES.md for the rationale on every added/renamed column.

Columns marked "gap-fill" are additions required by the SRS prose (FR-xx-xx)
even though the literal schema table in the SRS omitted them; these are
documented in docs/TRACEABILITY_MATRIX.md and docs/SRS_AMBIGUITIES.md.
"""
from datetime import datetime, date

from sqlalchemy import (
    BigInteger,
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

    login: Mapped["Login"] = relationship()


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
    roomtype: Mapped[str] = mapped_column(String(20), nullable=False)  # AC/Non-AC/Deluxe

    hostel: Mapped["Hostel"] = relationship(foreign_keys=[hostelid])

    __table_args__ = (
        UniqueConstraint("hostelid", "roomnumber", name="uq_room_hostel_number"),
        CheckConstraint("occupiedbeds >= 0", name="ck_room_occupied_nonneg"),
        CheckConstraint("occupiedbeds <= capacity", name="ck_room_occupied_le_capacity"),
    )


class Allocation(Base):
    __tablename__ = "allocation"

    allocationid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    studentid: Mapped[int] = mapped_column(Integer, ForeignKey("student.studentid"), nullable=False)
    roomid: Mapped[int] = mapped_column(Integer, ForeignKey("room.roomid"), nullable=False)
    allocationdate: Mapped[date] = mapped_column(Date, nullable=False)
    vacatedate: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="Active")  # Active/Vacated/Transferred

    student: Mapped["Student"] = relationship()
    room: Mapped["Room"] = relationship()


class FeeStructure(Base):
    """Supporting table for FR-FM-01: amount due per room category per semester."""

    __tablename__ = "fee_structures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    roomtype: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    effective_semester: Mapped[str] = mapped_column(String(20), nullable=False)

    __table_args__ = (
        UniqueConstraint("roomtype", "effective_semester", name="uq_feestructure_type_sem"),
    )


class Fee(Base):
    __tablename__ = "fee"

    feeid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    studentid: Mapped[int] = mapped_column(Integer, ForeignKey("student.studentid"), nullable=False)
    amountdue: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    amountpaid: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.00)
    duedate: Mapped[date] = mapped_column(Date, nullable=False)
    paymentstatus: Mapped[str] = mapped_column(String(20), nullable=False, default="Pending")
    txnreference: Mapped[str | None] = mapped_column(String(100), nullable=True)

    student: Mapped["Student"] = relationship()


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
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="Open")
    createdat: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    # gap-fill for FR-CM-02 auto-assignment
    assignedstaffid: Mapped[int | None] = mapped_column(Integer, ForeignKey("staff.staffid"), nullable=True)

    student: Mapped["Student"] = relationship()
    assigned_staff: Mapped["Staff | None"] = relationship()


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
