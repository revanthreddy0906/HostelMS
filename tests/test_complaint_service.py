import pytest

from hms.services.complaint_service import ComplaintService
from hms.services.exceptions import HMSValidationError
from tests.helpers import make_admin, make_student, student_actor, make_hostel_and_room, make_staff, staff_actor


def test_complaint_auto_assignment_by_category(session):
    admin = make_admin(session)
    student = make_student(session, admin, roll="C1", gender="Male")
    student_user = student_actor(student)
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male")
    maint = make_staff(session, admin, hostel, designation="Maintenance", role="Staff", username="maint1")

    complaint_service = ComplaintService(session)
    complaint = complaint_service.register_complaint(student_user, "Plumbing", "Tap leaking")
    assert complaint.assignedstaffid == maint.staffid
    assert complaint.status == "Open"


def test_complaint_least_loaded_staff_assignment(session):
    admin = make_admin(session)
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male")
    staff_a = make_staff(session, admin, hostel, designation="Cleaner", role="Staff", username="cleanA")
    staff_b = make_staff(session, admin, hostel, designation="Cleaner", role="Staff", username="cleanB")

    student1 = make_student(session, admin, roll="C2", gender="Male")
    student2 = make_student(session, admin, roll="C3", gender="Male")

    complaint_service = ComplaintService(session)
    c1 = complaint_service.register_complaint(student_actor(student1), "Cleaning", "Room dirty")
    # Second complaint should go to the other (least-loaded) staff member
    c2 = complaint_service.register_complaint(student_actor(student2), "Cleaning", "Corridor dirty")
    assert c1.assignedstaffid != c2.assignedstaffid


def test_status_progression_enforced(session):
    admin = make_admin(session)
    student = make_student(session, admin, roll="C4", gender="Male")
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male")
    staff = make_staff(session, admin, hostel, designation="Security", role="Staff", username="sec3")

    complaint_service = ComplaintService(session)
    complaint = complaint_service.register_complaint(student_actor(student), "Others", "Noise complaint")
    staff_user = staff_actor(staff, role="Staff")

    updated = complaint_service.update_status(staff_user, complaint.complaintid, "In Progress")
    assert updated.status == "In Progress"

    with pytest.raises(HMSValidationError):
        complaint_service.update_status(staff_user, complaint.complaintid, "Open")  # backward move rejected

    updated = complaint_service.update_status(staff_user, complaint.complaintid, "Resolved")
    updated = complaint_service.update_status(staff_user, complaint.complaintid, "Closed")
    assert updated.status == "Closed"
