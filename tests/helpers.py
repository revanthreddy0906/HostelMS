"""Shared test helpers for building CurrentUser actors quickly."""
from datetime import date

from hms.services.auth_service import AuthService
from hms.services.student_service import StudentService
from hms.services.staff_service import StaffService
from hms.services.room_service import HostelService, RoomService
from hms.repositories.repos import AdminRepository
from hms.models.models import Admin
from hms.services.rbac import CurrentUser


def make_admin(session, username="admin", password="Admin@12345"):
    auth = AuthService(session)
    login = auth.create_login(username, password, role="Admin")
    AdminRepository(session).add(Admin(userid=login.userid, fullname="Admin", email=f"{username}@x.com", phonenumber="9000000000"))
    session.flush()
    return CurrentUser(userid=login.userid, username=username, role="Admin")


def make_hostel_and_room(session, admin_user, gendertype="Male", capacity=2, roomtype="Non-AC"):
    hostel_service = HostelService(session)
    room_service = RoomService(session)
    hostel = hostel_service.create_hostel(admin_user, hostelname=f"Block-{gendertype}-{id(object())}", gendertype=gendertype, totalrooms=1)
    room = room_service.create_room(admin_user, hostelid=hostel.hostelid, roomnumber="101", capacity=capacity, roomtype=roomtype)
    return hostel, room


def make_student(session, admin_user, roll, gender="Male", username=None):
    student_service = StudentService(session)
    username = username or f"stu_{roll}"
    student = student_service.create_student(
        admin_user, username=username, plain_password="Student@123",
        rollnumber=roll, firstname="Test", lastname="Student", gender=gender,
        contactphone="9000000001", guardianphone="9000000002", dateofbirth=date(2004, 1, 1),
    )
    return student


def student_actor(student):
    return CurrentUser(userid=student.userid, username=student.rollnumber, role="Student", entity_id=student.studentid)


def make_staff(session, admin_user, hostel, designation="Warden", role="Warden", username=None):
    staff_service = StaffService(session)
    username = username or f"staff_{designation.lower()}"
    staff = staff_service.create_staff(
        admin_user, username=username, plain_password="Staff@123",
        fullname=f"{designation} Person", designation=designation, assignedblock=hostel.hostelid, role=role,
    )
    return staff


def staff_actor(staff, role="Warden"):
    return CurrentUser(userid=staff.userid, username="staff", role=role, entity_id=staff.staffid)
