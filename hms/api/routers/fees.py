from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from hms.api.deps import get_current_user, get_db
from hms.api.schemas.fee import FeeOut, FinanceSummary, GenerateRentRequest, PayFeeRequest, PaymentOut
from hms.services.fee_service import FeeService
from hms.services.rbac import CurrentUser

router = APIRouter(prefix="/api/fees", tags=["fees"])


@router.post("/generate-rent", response_model=list[FeeOut])
def generate_rent(payload: GenerateRentRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    service = FeeService(db)
    return [service.view(f) for f in service.generate_monthly_rent(current_user, payload.period)]


@router.get("/summary", response_model=FinanceSummary)
def finance_summary(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return FeeService(db).summary(current_user)


@router.get("/student/{studentid}", response_model=list[FeeOut])
def list_fees_for_student(studentid: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    service = FeeService(db)
    return [service.view(f) for f in service.list_fees_for_student(current_user, studentid)]


@router.get("/student/{studentid}/payments", response_model=list[PaymentOut])
def list_payments_for_student(studentid: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return FeeService(db).list_payments_for_student(current_user, studentid)


@router.get("/me", response_model=list[FeeOut])
def my_fees(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    service = FeeService(db)
    return [service.view(f) for f in service.list_my_fees(current_user)]


@router.get("/me/payments", response_model=list[PaymentOut])
def my_payments(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    service = FeeService(db)
    service.list_my_fees(current_user)  # Student-only check
    return service.list_payments_for_student(current_user, current_user.entity_id)


@router.post("/{feeid}/pay", response_model=FeeOut)
def pay_fee(feeid: int, payload: PayFeeRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    service = FeeService(db)
    return service.view(service.pay_fee(current_user, feeid, payload.amount))


@router.post("/mark-overdue")
def mark_overdue(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    count = FeeService(db).mark_overdue(current_user)
    return {"marked_overdue": count}
