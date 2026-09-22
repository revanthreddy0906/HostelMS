from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from hms.api.deps import get_current_user, get_db
from hms.api.schemas.staff import StaffCreate, StaffOut
from hms.services.rbac import CurrentUser
from hms.services.staff_service import StaffService

router = APIRouter(prefix="/api/staff", tags=["staff"])


@router.get("", response_model=list[StaffOut])
def list_staff(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return StaffService(db).list_staff(current_user)


@router.post("", response_model=StaffOut, status_code=201)
def create_staff(payload: StaffCreate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return StaffService(db).create_staff(current_user, **payload.model_dump())


@router.get("/{staffid}", response_model=StaffOut)
def get_staff(staffid: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return StaffService(db).get_staff(staffid)
