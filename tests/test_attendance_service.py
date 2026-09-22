from datetime import date, timedelta

from hms.services.attendance_service import AttendanceService
from tests.helpers import make_admin, make_student, make_hostel_and_room, make_staff, staff_actor


def test_mark_and_re_mark_attendance(session):
    admin = make_admin(session)
    student = make_student(session, admin, roll="A1", gender="Male")
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male")
    warden = make_staff(session, admin, hostel, designation="Warden", role="Warden")
    warden_user = staff_actor(warden, role="Warden")

    att_service = AttendanceService(session)
    record = att_service.mark_attendance(warden_user, student.studentid, date.today(), "Present")
    assert record.status == "Present"

    updated = att_service.mark_attendance(warden_user, student.studentid, date.today(), "Absent")
    assert updated.status == "Absent"
    assert updated.attendanceid == record.attendanceid  # same row updated, not duplicated


def test_consecutive_absentee_alert(session):
    admin = make_admin(session)
    student = make_student(session, admin, roll="A2", gender="Male")
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male")
    warden = make_staff(session, admin, hostel, designation="Warden", role="Warden")
    warden_user = staff_actor(warden, role="Warden")

    att_service = AttendanceService(session)
    today = date.today()
    for i in range(4):
        att_service.mark_attendance(warden_user, student.studentid, today - timedelta(days=i), "Absent")
    session.commit()

    alerts = att_service.consecutive_absentee_alerts(warden_user, threshold=3)
    assert len(alerts) == 1
    assert alerts[0]["studentid"] == student.studentid
    assert alerts[0]["consecutive_absent_days"] >= 3
