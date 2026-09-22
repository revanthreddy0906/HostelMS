import pytest
from hms.services.exceptions import HMSPermissionError
from hms.services.student_service import StudentService
from hms.services.rbac import CurrentUser
from tests.helpers import make_admin


def test_student_cannot_create_student(session):
    admin = make_admin(session)
    student_service = StudentService(session)
    fake_student_user = CurrentUser(userid=999, username="notadmin", role="Student")
    with pytest.raises(HMSPermissionError):
        student_service.create_student(
            fake_student_user, username="x", plain_password="x", rollnumber="X1",
            firstname="X", lastname="Y", gender="Male", contactphone="1", guardianphone="2",
            dateofbirth=__import__("datetime").date(2000, 1, 1),
        )


def test_admin_can_create_student(session):
    admin = make_admin(session)
    student_service = StudentService(session)
    import datetime
    student = student_service.create_student(
        admin, username="s1", plain_password="Pass@123", rollnumber="X2",
        firstname="X", lastname="Y", gender="Male", contactphone="1", guardianphone="2",
        dateofbirth=datetime.date(2000, 1, 1),
    )
    assert student.rollnumber == "X2"
