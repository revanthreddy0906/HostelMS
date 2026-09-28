"""Routers for the PG features: maintenance, food menu, AC billing, parent accommodation, announcements, dashboard."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from hms.api.deps import get_current_user, get_db
from hms.api.schemas.hostel import RoomOut
from hms.api.schemas.pg import (
    ACApprove,
    ACReadingCreate,
    ACReadingOut,
    ACRoom,
    AnnouncementCreate,
    AnnouncementOut,
    GuestCreate,
    GuestOut,
    GuestStatus,
    MaintenanceAssign,
    MaintenanceCreate,
    MaintenanceOut,
    MaintenanceStatusUpdate,
    MenuDay,
    MenuWeek,
    ParentRoom,
)
from hms.services.ac_service import ACService
from hms.services.announcement_service import AnnouncementService
from hms.services.dashboard_service import DashboardService
from hms.services.maintenance_service import CATEGORIES, PRIORITIES, MaintenanceService
from hms.services.menu_service import MenuService
from hms.services.parent_service import ParentService
from hms.services.rbac import CurrentUser

maintenance = APIRouter(prefix="/api/maintenance", tags=["maintenance"])
menu = APIRouter(prefix="/api/food-menu", tags=["food-menu"])
ac = APIRouter(prefix="/api/ac", tags=["ac"])
parents = APIRouter(prefix="/api/parents", tags=["parents"])
announcements = APIRouter(prefix="/api/announcements", tags=["announcements"])
dashboard = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

User = Depends(get_current_user)
DB = Depends(get_db)


@maintenance.get("/options")
def maintenance_options(current_user: CurrentUser = User):
    return {"categories": CATEGORIES, "priorities": PRIORITIES}


@maintenance.get("", response_model=list[MaintenanceOut])
def list_maintenance(db: Session = DB, current_user: CurrentUser = User):
    return MaintenanceService(db).list_all(current_user)


@maintenance.get("/me", response_model=list[MaintenanceOut])
def my_maintenance(db: Session = DB, current_user: CurrentUser = User):
    return MaintenanceService(db).list_mine(current_user)


@maintenance.post("", response_model=MaintenanceOut, status_code=201)
def create_maintenance(payload: MaintenanceCreate, db: Session = DB, current_user: CurrentUser = User):
    return MaintenanceService(db).create(current_user, payload.category, payload.description, payload.priority, payload.photo)


@maintenance.post("/{requestid}/assign", response_model=MaintenanceOut)
def assign_maintenance(requestid: int, payload: MaintenanceAssign, db: Session = DB, current_user: CurrentUser = User):
    return MaintenanceService(db).assign(current_user, requestid, payload.staffid)


@maintenance.post("/{requestid}/status", response_model=MaintenanceOut)
def maintenance_status(requestid: int, payload: MaintenanceStatusUpdate, db: Session = DB, current_user: CurrentUser = User):
    return MaintenanceService(db).update_status(current_user, requestid, payload.new_status, payload.note)


@menu.get("", response_model=list[MenuDay])
def get_menu(db: Session = DB, current_user: CurrentUser = User):
    return MenuService(db).get_week()


@menu.put("", response_model=list[MenuDay])
def save_menu(payload: MenuWeek, db: Session = DB, current_user: CurrentUser = User):
    return MenuService(db).save_week(current_user, [d.model_dump() for d in payload.days])


@ac.get("/rooms", response_model=list[ACRoom])
def ac_rooms(db: Session = DB, current_user: CurrentUser = User):
    return ACService(db).ac_rooms(current_user)


@ac.post("/rooms/{roomid}/request", response_model=RoomOut)
def request_ac(roomid: int, db: Session = DB, current_user: CurrentUser = User):
    return ACService(db).request_ac(current_user, roomid)


@ac.post("/rooms/{roomid}/approve", response_model=RoomOut)
def approve_ac(roomid: int, payload: ACApprove, db: Session = DB, current_user: CurrentUser = User):
    return ACService(db).approve(current_user, roomid, payload.initialreading)


@ac.post("/rooms/{roomid}/reject", response_model=RoomOut)
def reject_ac(roomid: int, db: Session = DB, current_user: CurrentUser = User):
    return ACService(db).reject_request(current_user, roomid)


@ac.get("/readings", response_model=list[ACReadingOut])
def ac_readings(db: Session = DB, current_user: CurrentUser = User):
    return ACService(db).list_readings(current_user)


@ac.post("/readings", response_model=ACReadingOut, status_code=201)
def record_reading(payload: ACReadingCreate, db: Session = DB, current_user: CurrentUser = User):
    return ACService(db).record_reading(current_user, payload.roomid, payload.period, payload.currentreading)


@parents.get("/rooms", response_model=list[ParentRoom])
def parent_rooms(db: Session = DB, current_user: CurrentUser = User):
    return ParentService(db).list_rooms(current_user)


@parents.get("/guests", response_model=list[GuestOut])
def parent_guests(db: Session = DB, current_user: CurrentUser = User):
    return ParentService(db).list_guests(current_user)


@parents.get("/guests/student/{studentid}", response_model=list[GuestOut])
def parent_guests_for_student(studentid: int, db: Session = DB, current_user: CurrentUser = User):
    return ParentService(db).list_for_student(current_user, studentid)


@parents.post("/guests", response_model=GuestOut, status_code=201)
def book_guest(payload: GuestCreate, db: Session = DB, current_user: CurrentUser = User):
    return ParentService(db).book(current_user, **payload.model_dump())


@parents.post("/guests/{guestid}/status", response_model=GuestOut)
def guest_status(guestid: int, payload: GuestStatus, db: Session = DB, current_user: CurrentUser = User):
    return ParentService(db).set_status(current_user, guestid, payload.status)


@announcements.get("", response_model=list[AnnouncementOut])
def list_announcements(db: Session = DB, current_user: CurrentUser = User):
    return AnnouncementService(db).list_recent()


@announcements.post("", response_model=AnnouncementOut, status_code=201)
def create_announcement(payload: AnnouncementCreate, db: Session = DB, current_user: CurrentUser = User):
    return AnnouncementService(db).create(current_user, payload.title, payload.body, payload.pinned)


@announcements.delete("/{announcementid}", status_code=204)
def delete_announcement(announcementid: int, db: Session = DB, current_user: CurrentUser = User):
    AnnouncementService(db).delete(current_user, announcementid)


@dashboard.get("/admin")
def admin_dashboard(db: Session = DB, current_user: CurrentUser = User):
    return DashboardService(db).admin_summary(current_user)
