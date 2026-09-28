import time

from hms.services.visitor_service import VisitorService
from hms.config import MAX_VISITING_HOURS
from tests.helpers import make_admin, make_student, make_hostel_and_room, make_staff, staff_actor


def test_visitor_entry_and_exit_logging(session):
    admin = make_admin(session)
    student = make_student(session, admin, roll="V1", gender="Male")
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male")
    staff = make_staff(session, admin, hostel, designation="Security", role="Staff", username="secv1")
    staff_user = staff_actor(staff, role="Staff")

    visitor_service = VisitorService(session)
    visitor = visitor_service.log_entry(staff_user, "Mr. Guardian", student.studentid, "Father", contactnumber="9111111111")
    assert visitor.outtime is None

    dashboard = visitor_service.security_dashboard(staff_user)
    assert any(v["visitorid"] == visitor.visitorid for v in dashboard)

    exited = visitor_service.log_exit(staff_user, visitor.visitorid)
    assert exited.outtime is not None

    dashboard_after = visitor_service.security_dashboard(staff_user)
    assert not any(v["visitorid"] == visitor.visitorid for v in dashboard_after)


def test_overstaying_visitor_flagged(session, monkeypatch):
    from datetime import datetime, timedelta
    admin = make_admin(session)
    student = make_student(session, admin, roll="V2", gender="Male")
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male")
    staff = make_staff(session, admin, hostel, designation="Security", role="Staff", username="secv2")
    staff_user = staff_actor(staff, role="Staff")

    visitor_service = VisitorService(session)
    visitor = visitor_service.log_entry(staff_user, "Overstayer", student.studentid, "Uncle")
    # Backdate intime beyond MAX_VISITING_HOURS to simulate an overstay
    visitor.intime = datetime.utcnow() - timedelta(hours=MAX_VISITING_HOURS + 1)
    session.flush()

    dashboard = visitor_service.security_dashboard(staff_user)
    row = next(v for v in dashboard if v["visitorid"] == visitor.visitorid)
    assert row["overstaying"] is True
