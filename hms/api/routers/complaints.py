from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from hms.api.deps import get_current_user, get_db
from hms.api.schemas.complaint import ComplaintCreate, ComplaintOut, ComplaintStatusUpdate
from hms.services.complaint_service import ComplaintService
from hms.services.rbac import CurrentUser

router = APIRouter(prefix="/api/complaints", tags=["complaints"])


@router.get("", response_model=list[ComplaintOut])
def list_complaints(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return [ComplaintService.view(c, reveal_student=False) for c in ComplaintService(db).list_all(current_user)]


@router.get("/me", response_model=list[ComplaintOut])
def my_complaints(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return [ComplaintService.view(c, reveal_student=True) for c in ComplaintService(db).list_mine(current_user)]


@router.post("", response_model=ComplaintOut, status_code=201)
def register_complaint(payload: ComplaintCreate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    c = ComplaintService(db).register_complaint(
        current_user, payload.category, payload.description,
        meal=payload.meal, mealdate=payload.mealdate, rating=payload.rating, isanonymous=payload.isanonymous,
    )
    return ComplaintService.view(c, reveal_student=True)


@router.post("/{complaintid}/status", response_model=ComplaintOut)
def update_status(
    complaintid: int, payload: ComplaintStatusUpdate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)
):
    return ComplaintService.view(ComplaintService(db).update_status(current_user, complaintid, payload.new_status), reveal_student=False)
