"""
Reset the database and seed demo data.

WARNING: this drops every table and recreates it, so run it only against the
demo database. It builds a hostel shaped like the PG overview document:

  Sunrise Boys PG      floors 1-5 with 3/4/5-sharing rooms, floor 6 Pentahouse,
                       floor 7 parent accommodation (P-01..P-04)
  Lotus Girls Hostel   floors 1-2 (the SRS keeps Male/Female/Mixed blocks)

plus staff, students (Room 304: 4 sharing, 3 of 4 beds taken), August and
September rent (some September bills unpaid so the late fine is visible),
security deposits, and one completed vacating settlement.

Default admin: admin / Admin@12345 (override with HMS_ADMIN_USERNAME /
HMS_ADMIN_PASSWORD). The password is bcrypt-hashed at seed time.

Run with:  python scripts/seed_db.py
"""
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hms.config import DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME
from hms.db import engine, session_scope
from hms.models.base import Base
from hms.models.models import Admin
from hms.repositories.repos import AdminRepository, FeeRepository
from hms.services.allocation_service import AllocationService
from hms.services.auth_service import AuthService
from hms.services.fee_service import DEPOSIT_PERIOD, FeeService
from hms.services.leave_service import LeaveService
from hms.services.rbac import CurrentUser
from hms.services.room_service import HostelService, RoomService
from hms.services.settlement_service import SettlementService
from hms.services.staff_service import StaffService
from hms.services.student_service import StudentService

JOINED = date(2026, 8, 1)

BOYS = [
    # roll, first, last, phone, guardian, dob, college, course, year, food
    ("S1001", "Arjun", "Verma", "9000000001", "9000000011", date(2004, 5, 1), "CBIT", "B.E. CSE", "3rd year", "Non-Veg"),
    ("S1002", "Rohit", "Sharma", "9000000002", "9000000012", date(2003, 8, 12), "CBIT", "B.E. ECE", "4th year", "Veg"),
    ("S1005", "Srujan", "Reddy", "9000000005", "9000000015", date(2004, 2, 17), "CBIT", "B.E. CSE", "3rd year", "Non-Veg"),
    ("S1006", "Karthik", "Rao", "9000000006", "9000000016", date(2004, 9, 9), "Vasavi College", "B.Tech IT", "3rd year", "Veg"),
    ("S1007", "Vivek", "Menon", "9000000007", "9000000017", date(2005, 1, 4), "CBIT", "B.E. Mech", "2nd year", "Non-Veg"),
    ("S1008", "Nikhil", "Gupta", "9000000008", "9000000018", date(2003, 12, 22), "Osmania University", "B.Com", "3rd year", "Veg"),
    ("S1009", "Sai", "Teja", "9000000009", "9000000019", date(2005, 6, 30), "CBIT", "B.E. Civil", "2nd year", "Non-Veg"),
    ("S1010", "Harsha", "Vardhan", "9000000010", "9000000020", date(2004, 3, 14), "MGIT", "B.Tech CSE", "3rd year", "Veg"),
    ("S1011", "Manoj", "Kumar", "9000000021", "9000000031", date(2003, 7, 7), "CBIT", "M.Tech", "1st year", "Non-Veg"),
    ("S1012", "Kiran", "Naidu", "9000000022", "9000000032", date(2005, 10, 19), "Vasavi College", "B.E. EEE", "2nd year", "Veg"),
    ("S1013", "Rahul", "Das", "9000000023", "9000000033", date(2004, 11, 2), "CBIT", "B.E. CSE", "3rd year", "Non-Veg"),
    ("S1014", "Aditya", "Singh", "9000000024", "9000000034", date(2005, 4, 25), "MGIT", "B.Tech ECE", "2nd year", "Veg"),
]
GIRLS = [
    ("S1003", "Priya", "Nair", "9000000003", "9000000013", date(2004, 1, 20), "CBIT", "B.E. CSE", "3rd year", "Veg"),
    ("S1004", "Divya", "Iyer", "9000000004", "9000000014", date(2003, 11, 3), "CBIT", "B.E. IT", "4th year", "Veg"),
    ("S1015", "Ananya", "Joshi", "9000000025", "9000000035", date(2005, 8, 8), "Vasavi College", "B.Tech CSE", "2nd year", "Non-Veg"),
]

# Where each boy lives (room number); Arjun, Srujan and Karthik share Room 304 (4 sharing, 3/4 taken).
BOY_ROOMS = {
    "S1001": "304", "S1005": "304", "S1006": "304",
    "S1002": "301", "S1007": "301",
    "S1008": "202", "S1009": "202", "S1010": "202", "S1011": "202",
    "S1012": "103",
    "S1013": "101",  # vacates on 20 Sep with a settlement
}
GIRL_ROOMS = {"S1003": "101", "S1004": "101", "S1015": "102"}

# September rent left unpaid (late fine accrues); S1007 paid late on 10 Sep (₹350 fine, as in the document).
SEPT_UNPAID = {"S1001", "S1009", "S1012"}
SEPT_PAID_LATE = {"S1007": date(2026, 9, 10)}


def reset_schema():
    """Drop every table (including ones no longer in the model) and recreate the current schema."""
    if engine.dialect.name == "sqlite":
        with engine.connect() as conn:
            conn.exec_driver_sql("PRAGMA foreign_keys=OFF")
            names = [r[0] for r in conn.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
            for name in names:
                conn.exec_driver_sql(f'DROP TABLE IF EXISTS "{name}"')
            conn.commit()
    else:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def main():
    reset_schema()

    with session_scope() as session:
        auth = AuthService(session)
        admin_login = auth.create_login(DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD, role="Admin")
        AdminRepository(session).add(
            Admin(userid=admin_login.userid, fullname="System Administrator", email="admin@hms.local", phonenumber="9999999999")
        )
        session.flush()
        admin = CurrentUser(userid=admin_login.userid, username=admin_login.username, role="Admin")

        # --- Blocks, floors, rooms, beds ---
        hostels = HostelService(session)
        rooms = RoomService(session)
        boys = hostels.create_hostel(admin, hostelname="Sunrise Boys PG", gendertype="Male", totalrooms=25)
        girls = hostels.create_hostel(admin, hostelname="Lotus Girls Hostel", gendertype="Female", totalrooms=6)

        room_ids: dict[tuple[int, str], int] = {}
        for floor in range(1, 6):
            for suffix, sharing in (("01", "3 Sharing"), ("02", "4 Sharing"), ("03", "5 Sharing"), ("04", "4 Sharing")):
                number = f"{floor}{suffix}"
                r = rooms.create_room(admin, hostelid=boys.hostelid, roomnumber=number, floor=floor, roomtype=sharing)
                room_ids[(boys.hostelid, number)] = r.roomid
        rooms.create_room(admin, hostelid=boys.hostelid, roomnumber="601", floor=6, roomtype="Pentahouse", capacity=2, monthlyrent=12000)
        for n in range(1, 5):
            rooms.create_room(admin, hostelid=boys.hostelid, roomnumber=f"P-0{n}", floor=7, roomtype="Parent", capacity=2, purpose="Parent")
        for floor in (1, 2):
            for suffix, sharing in (("01", "3 Sharing"), ("02", "4 Sharing"), ("03", "5 Sharing")):
                number = f"{floor}{suffix}"
                r = rooms.create_room(admin, hostelid=girls.hostelid, roomnumber=number, floor=floor, roomtype=sharing)
                room_ids[(girls.hostelid, number)] = r.roomid

        # --- Staff ---
        staff = StaffService(session)
        warden = staff.create_staff(
            admin, username="warden1", plain_password="Warden@123", fullname="Warden Kumar",
            designation="Warden", assignedblock=boys.hostelid, role="Warden",
        )
        hostels.assign_warden(admin, boys.hostelid, warden.staffid)
        for username, password, name, designation, block in (
            ("security1", "Security@123", "Security Ravi", "Security", boys),
            ("cleaner1", "Cleaner@123", "Cleaner Suma", "Cleaner", boys),
            ("maint1", "Maint@123", "Maintenance Joseph", "Maintenance", boys),
            ("tech1", "Tech@123", "Technician Anu", "Technician", girls),
        ):
            staff.create_staff(
                admin, username=username, plain_password=password, fullname=name,
                designation=designation, assignedblock=block.hostelid, role="Staff",
            )

        # --- Students (student1..student4 keep their earlier usernames) ---
        student_service = StudentService(session)
        usernames = {"S1001": "student1", "S1002": "student2", "S1003": "student3", "S1004": "student4"}
        students = {}
        for gender, rows in (("Male", BOYS), ("Female", GIRLS)):
            for roll, fn, ln, phone, gphone, dob, college, course, year, food in rows:
                students[roll] = student_service.create_student(
                    admin,
                    username=usernames.get(roll, roll.lower()),
                    plain_password="Student@123",
                    rollnumber=roll, firstname=fn, lastname=ln, gender=gender,
                    contactphone=phone, guardianphone=gphone, dateofbirth=dob,
                    bloodgroup="O+", emergencycontact=gphone,
                    email=f"{fn.lower()}.{ln.lower()}@example.com",
                    college=college, course=course, yearofstudy=year,
                    joiningdate=JOINED, foodpreference=food,
                )

        # --- Allocations (raises each student's ₹3,000 deposit) ---
        allocations = AllocationService(session)
        allocation_by_roll = {}
        for placement, block in ((BOY_ROOMS, boys), (GIRL_ROOMS, girls)):
            for roll, number in placement.items():
                allocation_by_roll[roll] = allocations.manual_allocate(
                    admin, students[roll].studentid, room_ids[(block.hostelid, number)], JOINED
                )
        # S1014 (Aditya) has just registered and is waiting for a room.

        # --- Deposits and rent history ---
        fees = FeeService(session)
        fee_repo = FeeRepository(session)
        for roll, student in students.items():
            deposit = fee_repo.find(student.studentid, "Deposit", DEPOSIT_PERIOD)
            if deposit:
                fees._apply_payment(deposit, float(deposit.amountdue), "Online", f"MOCK-DEP-{roll}", JOINED)
        for period in ("2026-08", "2026-09"):
            fees.generate_monthly_rent(admin, period)
        for roll, student in students.items():
            for bill in fee_repo.list_by_student(student.studentid):
                if bill.billtype != "Rent":
                    continue
                if bill.period == "2026-08":
                    fees._apply_payment(bill, float(bill.amountdue), "Online", f"MOCK-AUG-{roll}", date(2026, 8, 2))
                elif bill.period == "2026-09" and roll in SEPT_PAID_LATE:
                    on = SEPT_PAID_LATE[roll]
                    fees._apply_payment(bill, fees.balance_for(bill, on), "Online", f"MOCK-SEP-{roll}", on)
                elif bill.period == "2026-09" and roll not in SEPT_UNPAID:
                    fees._apply_payment(bill, float(bill.amountdue), "Online", f"MOCK-SEP-{roll}", date(2026, 9, 2))

        # --- Rahul (S1013) vacated on 20 Sep: no dues, ₹500 deducted from his ₹3,000 deposit ---
        SettlementService(session).settle(
            admin, allocation_by_roll["S1013"].allocationid,
            deduction=500, reason="Broken study-table drawer", vacate_date=date(2026, 9, 20),
        )

        # --- A pending leave request from Arjun (SRS leave workflow) ---
        arjun = CurrentUser(userid=students["S1001"].userid, username="student1", role="Student", entity_id=students["S1001"].studentid)
        LeaveService(session).apply_leave(arjun, date(2026, 10, 1), date(2026, 10, 5), "Family function")

    print("Database reset and seeded.")
    print(f"Admin:    {DEFAULT_ADMIN_USERNAME} / {DEFAULT_ADMIN_PASSWORD}")
    print("Warden:   warden1 / Warden@123")
    print("Security: security1 / Security@123   Maintenance: maint1 / Maint@123")
    print("Students: student1 (Arjun, Room 304), student2..student4, s1005..s1015 / Student@123")


if __name__ == "__main__":
    main()
