from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from hms.api.deps import get_current_user, get_db
from hms.api.schemas.complaint import ComplaintCreate, ComplaintOut, ComplaintStatusUpdate
from hms.services.complaint_service import ComplaintService
from hms.services.rbac import CurrentUser

router = APIRouter(prefix="/api/complaints", tags=["complaints"])


@router.get("", response_model=list[ComplaintOut])
def list_complaints(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return ComplaintService(db).list_all()


@router.get("/me", response_model=list[ComplaintOut])
def my_complaints(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return ComplaintService(db).list_for_student(current_user.entity_id)


@router.post("", response_model=ComplaintOut, status_code=201)
def register_complaint(payload: ComplaintCreate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return ComplaintService(db).register_complaint(current_user, payload.category, payload.description)


@router.post("/{complaintid}/status", response_model=ComplaintOut)
def update_status(
    complaintid: int, payload: ComplaintStatusUpdate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)
):
    return ComplaintService(db).update_status(current_user, complaintid, payload.new_status)
