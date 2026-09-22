import pytest
from datetime import date

from hms.services.student_service import StudentService
from hms.services.exceptions import HMSValidationError
from tests.helpers import make_admin, make_student, student_actor


def test_student_self_update_noncritical_field(session):
    admin = make_admin(session)
    student = make_student(session, admin, roll="SM1", gender="Male")
    student_service = StudentService(session)
    updated = student_service.self_update_non_critical(student_actor(student), bloodgroup="B+")
    assert updated.bloodgroup == "B+"


def test_student_cannot_self_update_critical_field_directly(session):
    admin = make_admin(session)
    student = make_student(session, admin, roll="SM2", gender="Male")
    student_service = StudentService(session)
    with pytest.raises(HMSValidationError):
        student_service.self_update_non_critical(student_actor(student), firstname="Changed")


def test_critical_change_requires_admin_approval(session):
    admin = make_admin(session)
    student = make_student(session, admin, roll="SM3", gender="Male")
    student_service = StudentService(session)

    request = student_service.request_critical_change(student_actor(student), firstname="NewName")
    assert request["requested_changes"] == {"firstname": "NewName"}

    # Not yet applied
    fetched = student_service.get_student(student.studentid)
    assert fetched.firstname != "NewName"

    approved = student_service.apply_approved_change(admin, student.studentid, request["requested_changes"])
    assert approved.firstname == "NewName"


def test_duplicate_rollnumber_rejected(session):
    admin = make_admin(session)
    make_student(session, admin, roll="SM4", gender="Male")
    student_service = StudentService(session)
    with pytest.raises(HMSValidationError):
        student_service.create_student(
            admin, username="dup2", plain_password="Pass@123", rollnumber="SM4",
            firstname="A", lastname="B", gender="Male", contactphone="1", guardianphone="2",
            dateofbirth=date(2000, 1, 1),
        )
