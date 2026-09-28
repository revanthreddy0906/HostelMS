from datetime import date

import pytest

from hms.services.complaint_service import ComplaintService
from hms.services.exceptions import HMSValidationError
from tests.helpers import make_admin, make_hostel_and_room, make_staff, make_student, staff_actor, student_actor


def test_complaint_starts_pending_with_document_categories(session):
    admin = make_admin(session)
    student = make_student(session, admin, roll="C1")
    complaint = ComplaintService(session).register_complaint(student_actor(student), "Wi-Fi", "Slow in the evenings")
    assert complaint.status == "Pending"
    with pytest.raises(HMSValidationError):
        ComplaintService(session).register_complaint(student_actor(student), "Plumbing", "Repairs go to maintenance")


def test_food_feedback_fields_and_rating_range(session):
    admin = make_admin(session)
    student = make_student(session, admin, roll="C2")
    service = ComplaintService(session)
    fb = service.register_complaint(
        student_actor(student), "Food / Mess", "Dal was salty", meal="Lunch", mealdate=date(2026, 9, 1), rating=4
    )
    assert (fb.meal, fb.rating) == ("Lunch", 4)
    with pytest.raises(HMSValidationError):
        service.register_complaint(student_actor(student), "Food / Mess", "Bad", meal="Lunch", rating=6)
    with pytest.raises(HMSValidationError):
        service.register_complaint(student_actor(student), "Noise", "Loud", rating=3)  # rating only for food


def test_anonymous_complaint_hides_student_from_staff_view(session):
    admin = make_admin(session)
    student = make_student(session, admin, roll="C3")
    c = ComplaintService(session).register_complaint(student_actor(student), "Noise", "Loud music", isanonymous=True)
    assert ComplaintService.view(c, reveal_student=False)["studentid"] is None
    assert ComplaintService.view(c, reveal_student=True)["studentid"] == student.studentid


def test_status_moves_forward_only(session):
    admin = make_admin(session)
    student = make_student(session, admin, roll="C4")
    hostel, room = make_hostel_and_room(session, admin)
    warden = staff_actor(make_staff(session, admin, hostel, designation="Warden", role="Warden"), role="Warden")
    service = ComplaintService(session)
    c = service.register_complaint(student_actor(student), "Cleanliness", "Corridor not cleaned")
    for status in ("Reviewed", "In Progress", "Resolved"):
        c = service.update_status(warden, c.complaintid, status)
    assert c.status == "Resolved"
    with pytest.raises(HMSValidationError):
        service.update_status(warden, c.complaintid, "Pending")
