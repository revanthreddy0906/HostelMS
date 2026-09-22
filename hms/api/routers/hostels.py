from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from hms.api.deps import get_current_user, get_db
from hms.api.schemas.hostel import (
    AssignWardenRequest,
    HostelCreate,
    HostelOut,
    MaintenanceStatusRequest,
    OccupancyRow,
    RoomCreate,
    RoomOut,
)
from hms.services.rbac import CurrentUser
from hms.services.room_service import HostelService, RoomService

router = APIRouter(prefix="/api/hostels", tags=["hostels"])
rooms_router = APIRouter(prefix="/api/rooms", tags=["rooms"])


@router.get("", response_model=list[HostelOut])
def list_hostels(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return HostelService(db).list_hostels()


@router.post("", response_model=HostelOut, status_code=201)
def create_hostel(payload: HostelCreate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return HostelService(db).create_hostel(current_user, **payload.model_dump())


@router.post("/{hostelid}/assign-warden", response_model=HostelOut)
def assign_warden(
    hostelid: int, payload: AssignWardenRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)
):
    return HostelService(db).assign_warden(current_user, hostelid, payload.staffid)


@router.post("/{hostelid}/maintenance-status", response_model=HostelOut)
def set_maintenance_status(
    hostelid: int, payload: MaintenanceStatusRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)
):
    return HostelService(db).set_maintenance_status(current_user, hostelid, payload.status)


@rooms_router.get("", response_model=list[RoomOut])
def list_rooms(hostelid: int | None = None, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return RoomService(db).list_rooms(hostelid)


@rooms_router.post("", response_model=RoomOut, status_code=201)
def create_room(payload: RoomCreate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return RoomService(db).create_room(current_user, **payload.model_dump())


@rooms_router.get("/occupancy", response_model=list[OccupancyRow])
def occupancy_report(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return RoomService(db).occupancy_report_rows()
