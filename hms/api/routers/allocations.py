from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from hms.api.deps import get_current_user, get_db
from hms.api.schemas.allocation import (
    AllocationOut,
    AutoAllocateRequest,
    ChangeRoomRequest,
    ManualAllocateRequest,
    SettleRequest,
    SettlementOut,
    VacateRequest,
)
from hms.services.allocation_service import AllocationService
from hms.services.rbac import CurrentUser
from hms.services.settlement_service import SettlementService


def _out(a):
    return AllocationOut(
        allocationid=a.allocationid,
        studentid=a.studentid,
        roomid=a.roomid,
        allocationdate=a.allocationdate,
        vacatedate=a.vacatedate,
        status=a.status,
        bedid=a.bedid,
        bednumber=a.bed.bednumber if a.bed else None,
    )

router = APIRouter(prefix="/api/allocations", tags=["allocations"])


@router.get("", response_model=list[AllocationOut])
def list_active_allocations(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return [_out(a) for a in AllocationService(db).list_active(current_user)]


@router.get("/student/{studentid}", response_model=AllocationOut | None)
def get_student_allocation(studentid: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    a = AllocationService(db).active_for_student(current_user, studentid)
    return _out(a) if a else None


@router.post("/auto", response_model=AllocationOut)
def auto_allocate(payload: AutoAllocateRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return _out(AllocationService(db).auto_allocate(current_user, payload.studentid, payload.alloc_date))


@router.post("/manual", response_model=AllocationOut)
def manual_allocate(payload: ManualAllocateRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return _out(
        AllocationService(db).manual_allocate(current_user, payload.studentid, payload.roomid, payload.alloc_date, payload.bedid)
    )


@router.post("/{allocationid}/vacate", response_model=AllocationOut)
def vacate(
    allocationid: int, payload: VacateRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)
):
    return _out(AllocationService(db).vacate(current_user, allocationid, payload.vacate_date))


@router.post("/change-room", response_model=AllocationOut)
def change_room(payload: ChangeRoomRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return _out(
        AllocationService(db).change_room(current_user, payload.studentid, payload.new_roomid, payload.change_date, payload.bedid)
    )


@router.get("/{allocationid}/settlement-preview")
def settlement_preview(allocationid: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return SettlementService(db).preview(current_user, allocationid)


@router.post("/{allocationid}/settle", response_model=SettlementOut)
def settle(allocationid: int, payload: SettleRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return SettlementService(db).settle(current_user, allocationid, payload.deduction, payload.reason, payload.vacate_date)


@router.get("/settlements/student/{studentid}", response_model=list[SettlementOut])
def settlements_for_student(studentid: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return SettlementService(db).list_for_student(current_user, studentid)
