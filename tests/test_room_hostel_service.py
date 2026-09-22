import pytest

from hms.services.room_service import HostelService, RoomService
from hms.services.exceptions import HMSValidationError
from tests.helpers import make_admin, make_staff, make_hostel_and_room


def test_create_hostel_and_room(session):
    admin = make_admin(session)
    hostel_service = HostelService(session)
    room_service = RoomService(session)

    hostel = hostel_service.create_hostel(admin, hostelname="Test Block", gendertype="Mixed", totalrooms=2)
    room = room_service.create_room(admin, hostelid=hostel.hostelid, roomnumber="G1", capacity=3, roomtype="Deluxe")

    rooms = room_service.list_rooms(hostel.hostelid)
    assert len(rooms) == 1
    assert rooms[0].roomid == room.roomid


def test_invalid_gender_type_rejected(session):
    admin = make_admin(session)
    hostel_service = HostelService(session)
    with pytest.raises(HMSValidationError):
        hostel_service.create_hostel(admin, hostelname="Bad Block", gendertype="Other", totalrooms=1)


def test_assign_warden(session):
    admin = make_admin(session)
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male")
    warden = make_staff(session, admin, hostel, designation="Warden", role="Warden")

    hostel_service = HostelService(session)
    updated = hostel_service.assign_warden(admin, hostel.hostelid, warden.staffid)
    assert updated.wardenstaffid == warden.staffid


def test_occupancy_report_rows(session):
    admin = make_admin(session)
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male", capacity=4)
    room_service = RoomService(session)
    rows = room_service.occupancy_report_rows()
    assert any(r["room"] == room.roomnumber and r["capacity"] == 4 for r in rows)
