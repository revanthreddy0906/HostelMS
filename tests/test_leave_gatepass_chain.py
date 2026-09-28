"""
SRS §7.3 end-to-end integration test: Leave apply -> Warden approve -> gate
pass generated -> security exit log recorded -> security entry log recorded.
"""
from datetime import date

import pytest

from hms.services.leave_service import LeaveService, verify_gatepass_code
from hms.services.notification_service import ConsoleNotificationService
from hms.services.exceptions import HMSValidationError
from tests.helpers import make_admin, make_student, student_actor, make_hostel_and_room, make_staff, staff_actor


def test_full_leave_to_exit_entry_chain(session):
    admin = make_admin(session)
    student = make_student(session, admin, roll="L1", gender="Male")
    student_user = student_actor(student)

    hostel, room = make_hostel_and_room(session, admin, gendertype="Male")
    warden = make_staff(session, admin, hostel, designation="Warden", role="Warden")
    warden_user = staff_actor(warden, role="Warden")
    security = make_staff(session, admin, hostel, designation="Security", role="Staff", username="sec1")
    security_user = staff_actor(security, role="Staff")

    leave_service = LeaveService(session, notification_service=ConsoleNotificationService())

    # 1. Student applies for leave
    leave = leave_service.apply_leave(student_user, date(2026, 10, 1), date(2026, 10, 5), "Family event")
    assert leave.status == "Pending"

    # 2. Warden approves -> triggers mocked guardian notification + gate pass generation
    approved = leave_service.decide_leave(warden_user, leave.leaveid, approve=True)
    assert approved.status == "Approved"
    assert approved.gatepasscode is not None

    ok, decoded_leaveid = verify_gatepass_code(approved.gatepasscode, student.studentid)
    assert ok is True
    assert decoded_leaveid == leave.leaveid

    # QR PNG can be generated from the approved gate pass
    qr_bytes = leave_service.get_gatepass_qr(student_user, leave.leaveid)
    assert qr_bytes[:8] == b"\x89PNG\r\n\x1a\n"  # PNG magic bytes

    # 3. Security scans the pass and logs exit
    exited = leave_service.log_exit(security_user, approved.gatepasscode, student.studentid)
    assert exited.exitlogged is not None

    # Cannot log exit twice
    with pytest.raises(HMSValidationError):
        leave_service.log_exit(security_user, approved.gatepasscode, student.studentid)

    # 4. Security logs entry (return)
    returned = leave_service.log_entry(security_user, approved.gatepasscode, student.studentid)
    assert returned.entrylogged is not None
    assert returned.entrylogged >= returned.exitlogged


def test_tampered_gatepass_code_rejected(session):
    admin = make_admin(session)
    student = make_student(session, admin, roll="L2", gender="Male")
    student_user = student_actor(student)
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male")
    warden = make_staff(session, admin, hostel, designation="Warden", role="Warden")
    warden_user = staff_actor(warden, role="Warden")
    security = make_staff(session, admin, hostel, designation="Security", role="Staff", username="sec2")
    security_user = staff_actor(security, role="Staff")

    leave_service = LeaveService(session, notification_service=ConsoleNotificationService())
    leave = leave_service.apply_leave(student_user, date(2026, 11, 1), date(2026, 11, 2), "Trip")
    approved = leave_service.decide_leave(warden_user, leave.leaveid, approve=True)

    tampered_code = approved.gatepasscode[:-1] + ("0" if approved.gatepasscode[-1] != "0" else "1")
    with pytest.raises(HMSValidationError):
        leave_service.log_exit(security_user, tampered_code, student.studentid)


def test_rejected_leave_has_no_gatepass(session):
    admin = make_admin(session)
    student = make_student(session, admin, roll="L3", gender="Male")
    student_user = student_actor(student)
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male")
    warden = make_staff(session, admin, hostel, designation="Warden", role="Warden")
    warden_user = staff_actor(warden, role="Warden")

    leave_service = LeaveService(session, notification_service=ConsoleNotificationService())
    leave = leave_service.apply_leave(student_user, date(2026, 12, 1), date(2026, 12, 2), "Personal")
    rejected = leave_service.decide_leave(warden_user, leave.leaveid, approve=False)
    assert rejected.status == "Rejected"
    assert rejected.gatepasscode is None
    with pytest.raises(HMSValidationError):
        leave_service.get_gatepass_qr(student_user, leave.leaveid)
