"""
Fixtures for tests/api/*: a real FastAPI TestClient wired to an isolated
file-backed SQLite DB per test (file-backed, not :memory:, so that the
per-request sessions the API opens via get_db all see the same data --
an in-memory sqlite DB is per-connection and would look empty on the next
request otherwise).
"""
import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from hms.models.base import Base
from hms.models import models  # noqa: F401
from hms.api.main import app
from hms.api.deps import get_db
from hms.services.auth_service import AuthService
from hms.services.staff_service import StaffService
from hms.services.student_service import StudentService
from hms.services.room_service import HostelService, RoomService
from hms.services.rbac import CurrentUser
from hms.repositories.repos import AdminRepository
from hms.models.models import Admin


@pytest.fixture()
def db_engine():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    eng = create_engine(f"sqlite:///{path}", future=True)

    @event.listens_for(eng, "connect")
    def _fk_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()
    os.remove(path)


@pytest.fixture()
def client(db_engine):
    TestSessionLocal = sessionmaker(bind=db_engine, autoflush=False, autocommit=False, future=True)

    def _override_get_db():
        session = TestSessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def seeded(db_engine):
    """Seed admin/warden/student demo accounts directly via the service layer."""
    SessionLocal = sessionmaker(bind=db_engine, autoflush=False, autocommit=False, future=True)
    session = SessionLocal()
    try:
        auth = AuthService(session)
        admin_login = auth.create_login("admin", "Admin@12345", role="Admin")
        AdminRepository(session).add(
            Admin(userid=admin_login.userid, fullname="Admin", email="admin@hms.local", phonenumber="9999999999")
        )
        session.flush()
        admin_user = CurrentUser(userid=admin_login.userid, username="admin", role="Admin")

        hostel_service = HostelService(session)
        room_service = RoomService(session)
        hostel = hostel_service.create_hostel(admin_user, hostelname="Test Block", gendertype="Male", totalrooms=1)
        session.flush()
        room = room_service.create_room(admin_user, hostelid=hostel.hostelid, roomnumber="101", capacity=1, roomtype="Pentahouse", monthlyrent=25000)
        session.flush()

        staff_service = StaffService(session)
        warden = staff_service.create_staff(
            admin_user, username="warden1", plain_password="Warden@123", fullname="Warden One",
            designation="Warden", assignedblock=hostel.hostelid, role="Warden",
        )

        student_service = StudentService(session)
        student = student_service.create_student(
            admin_user, username="student1", plain_password="Student@123", rollnumber="S1",
            firstname="Stu", lastname="Dent", gender="Male", contactphone="9000000000",
            guardianphone="9000000001", dateofbirth=__import__("datetime").date(2004, 1, 1),
        )
        session.commit()
        return {
            "hostelid": hostel.hostelid,
            "roomid": room.roomid,
            "staffid": warden.staffid,
            "studentid": student.studentid,
        }
    finally:
        session.close()


def get_token(client, username, password):
    resp = client.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}
