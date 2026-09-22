from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from hms.api.deps import get_current_user, get_db
from hms.api.schemas.student import (
    ApproveChangeRequest,
    CriticalChangeRequest,
    StudentCreate,
    StudentOut,
    StudentSelfUpdate,
    StudentUpdate,
)
from hms.services.student_service import StudentService
from hms.services.rbac import CurrentUser

router = APIRouter(prefix="/api/students", tags=["students"])


@router.get("", response_model=list[StudentOut])
def list_students(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return StudentService(db).list_students(current_user)


@router.get("/me", response_model=StudentOut)
def get_my_profile(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return StudentService(db).get_student(current_user.entity_id)


@router.get("/{studentid}", response_model=StudentOut)
def get_student(studentid: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return StudentService(db).get_student(studentid)


@router.post("", response_model=StudentOut, status_code=201)
def create_student(
    payload: StudentCreate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)
):
    return StudentService(db).create_student(current_user, **payload.model_dump())


@router.put("/{studentid}", response_model=StudentOut)
def update_student(
    studentid: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    return StudentService(db).update_student(current_user, studentid, **fields)


@router.delete("/{studentid}", status_code=204)
def delete_student(studentid: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    StudentService(db).delete_student(current_user, studentid)


@router.put("/me/profile", response_model=StudentOut)
def self_update(
    payload: StudentSelfUpdate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)
):
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    return StudentService(db).self_update_non_critical(current_user, **fields)


@router.post("/me/request-change")
def request_critical_change(
    payload: CriticalChangeRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)
):
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    return StudentService(db).request_critical_change(current_user, **fields)


@router.post("/{studentid}/approve-change", response_model=StudentOut)
def approve_change(
    studentid: int,
    payload: ApproveChangeRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    return StudentService(db).apply_approved_change(current_user, studentid, payload.approved_fields)
