"""
Seed the database with schema + demo data.

Creates:
  - One Admin (bcrypt-hashed password from HMS_ADMIN_USERNAME/HMS_ADMIN_PASSWORD
    env vars, defaulting to admin / Admin@12345 -- a documented dev default,
    never hardcoded as a literal check anywhere in auth logic).
  - Two hostels (one Male, one Female), with rooms of mixed type.
  - A warden and a couple of staff members.
  - A handful of demo students, some active allocations, fee structures,
    sample fees, a complaint, and a leave request -- enough to exercise every
    module from the UI immediately after seeding.

Run with:  python scripts/seed_db.py
"""
import sys
import os
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hms.db import init_db, session_scope
from hms.config import DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD
from hms.services.auth_service import AuthService
from hms.services.student_service import StudentService
from hms.services.staff_service import StaffService
from hms.services.room_service import HostelService, RoomService
from hms.services.allocation_service import AllocationService
from hms.services.fee_service import FeeService
from hms.services.complaint_service import ComplaintService
from hms.services.leave_service import LeaveService
from hms.repositories.repos import AdminRepository
from hms.models.models import Admin
from hms.services.rbac import CurrentUser


def main():
    init_db()
    with session_scope() as session:
        auth = AuthService(session)

        # --- Admin ---
        admin_login = auth.create_login(DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD, role="Admin")
        AdminRepository(session).add(
            Admin(userid=admin_login.userid, fullname="System Administrator",
                  email="admin@hms.local", phonenumber="9999999999")
        )
        session.flush()
        admin_user = CurrentUser(userid=admin_login.userid, username=admin_login.username, role="Admin")

        # --- Hostels & Rooms ---
        hostel_service = HostelService(session)
        room_service = RoomService(session)

        boys_hostel = hostel_service.create_hostel(
            admin_user, hostelname="Aravali Block", gendertype="Male", totalrooms=4
        )
        girls_hostel = hostel_service.create_hostel(
            admin_user, hostelname="Nilgiri Block", gendertype="Female", totalrooms=4
        )

        for rn, rtype, cap in [("101", "Non-AC", 2), ("102", "AC", 2), ("103", "Deluxe", 1), ("104", "Non-AC", 3)]:
            room_service.create_room(admin_user, hostelid=boys_hostel.hostelid, roomnumber=rn, capacity=cap, roomtype=rtype)
        for rn, rtype, cap in [("201", "Non-AC", 2), ("202", "AC", 2), ("203", "Deluxe", 1), ("204", "Non-AC", 3)]:
            room_service.create_room(admin_user, hostelid=girls_hostel.hostelid, roomnumber=rn, capacity=cap, roomtype=rtype)

        # --- Staff (Warden + Security + Cleaner + Maintenance + Technician) ---
        staff_service = StaffService(session)
        warden = staff_service.create_staff(
            admin_user, username="warden1", plain_password="Warden@123",
            fullname="Warden Kumar", designation="Warden", assignedblock=boys_hostel.hostelid, role="Warden",
        )
        hostel_service.assign_warden(admin_user, boys_hostel.hostelid, warden.staffid)

        security = staff_service.create_staff(
            admin_user, username="security1", plain_password="Security@123",
            fullname="Security Ravi", designation="Security", assignedblock=boys_hostel.hostelid, role="Staff",
        )
        cleaner = staff_service.create_staff(
            admin_user, username="cleaner1", plain_password="Cleaner@123",
            fullname="Cleaner Suma", designation="Cleaner", assignedblock=boys_hostel.hostelid, role="Staff",
        )
        maintenance = staff_service.create_staff(
            admin_user, username="maint1", plain_password="Maint@123",
            fullname="Maintenance Joseph", designation="Maintenance", assignedblock=boys_hostel.hostelid, role="Staff",
        )
        technician = staff_service.create_staff(
            admin_user, username="tech1", plain_password="Tech@123",
            fullname="Technician Anu", designation="Technician", assignedblock=girls_hostel.hostelid, role="Staff",
        )

        # --- Students ---
        student_service = StudentService(session)
        students = []
        demo_students = [
            ("S1001", "Arjun", "Verma", "Male", "9000000001", "9000000011", date(2004, 5, 1)),
            ("S1002", "Rohit", "Sharma", "Male", "9000000002", "9000000012", date(2003, 8, 12)),
            ("S1003", "Priya", "Nair", "Female", "9000000003", "9000000013", date(2004, 1, 20)),
            ("S1004", "Divya", "Iyer", "Female", "9000000004", "9000000014", date(2003, 11, 3)),
        ]
        for i, (roll, fn, ln, gender, phone, gphone, dob) in enumerate(demo_students, start=1):
            s = student_service.create_student(
                admin_user, username=f"student{i}", plain_password="Student@123",
                rollnumber=roll, firstname=fn, lastname=ln, gender=gender,
                contactphone=phone, guardianphone=gphone, dateofbirth=dob,
                bloodgroup="O+", emergencycontact=gphone,
            )
            students.append(s)

        # --- Allocations (auto-allocate each student to a matching-gender room) ---
        allocation_service = AllocationService(session)
        allocations = []
        for s in students:
            alloc = allocation_service.auto_allocate(admin_user, s.studentid)
            allocations.append(alloc)

        # --- Fee structures & generated fees ---
        fee_service = FeeService(session)
        fee_service.set_fee_structure(admin_user, "Non-AC", 25000.00, "Sem1-2026")
        fee_service.set_fee_structure(admin_user, "AC", 40000.00, "Sem1-2026")
        fee_service.set_fee_structure(admin_user, "Deluxe", 55000.00, "Sem1-2026")
        fee_service.generate_fees_for_active_allocations(admin_user, "Sem1-2026", date(2026, 10, 31))

        # --- Sample complaint (from first student) ---
        s1_user = CurrentUser(userid=students[0].userid, username="student1", role="Student", entity_id=students[0].studentid)
        complaint_service = ComplaintService(session)
        complaint_service.register_complaint(s1_user, "Plumbing", "Leaking tap in room bathroom")

        # --- Sample leave request ---
        leave_service = LeaveService(session)
        leave_service.apply_leave(s1_user, date(2026, 10, 1), date(2026, 10, 5), "Family function")

    print("Database seeded successfully.")
    print(f"Admin login: {DEFAULT_ADMIN_USERNAME} / {DEFAULT_ADMIN_PASSWORD}")
    print("Warden login: warden1 / Warden@123")
    print("Student logins: student1..student4 / Student@123")


if __name__ == "__main__":
    main()
