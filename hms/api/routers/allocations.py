from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from hms.api.deps import get_current_user, get_db
from hms.api.schemas.allocation import (
    AllocationOut,
    AutoAllocateRequest,
    ChangeRoomRequest,
    ManualAllocateRequest,
    VacateRequest,
)
from hms.services.allocation_service import AllocationService
from hms.services.rbac import CurrentUser

router = APIRouter(prefix="/api/allocations", tags=["allocations"])


@router.get("", response_model=list[AllocationOut])
def list_active_allocations(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return AllocationService(db).list_active(current_user)


@router.get("/student/{studentid}", response_model=AllocationOut | None)
def get_student_allocation(studentid: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return AllocationService(db).active_for_student(current_user, studentid)


@router.post("/auto", response_model=AllocationOut)
def auto_allocate(payload: AutoAllocateRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return AllocationService(db).auto_allocate(current_user, payload.studentid, payload.alloc_date)


@router.post("/manual", response_model=AllocationOut)
def manual_allocate(payload: ManualAllocateRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return AllocationService(db).manual_allocate(current_user, payload.studentid, payload.roomid, payload.alloc_date)


@router.post("/{allocationid}/vacate", response_model=AllocationOut)
def vacate(
    allocationid: int, payload: VacateRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)
):
    return AllocationService(db).vacate(current_user, allocationid, payload.vacate_date)


@router.post("/change-room", response_model=AllocationOut)
def change_room(payload: ChangeRoomRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return AllocationService(db).change_room(current_user, payload.studentid, payload.new_roomid, payload.change_date)
