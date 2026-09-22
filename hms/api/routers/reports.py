import os
import tempfile
from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from hms.api.deps import get_current_user, get_db
from hms.reports import excel_reports, pdf_reports
from hms.services.rbac import CurrentUser
from hms.services.report_service import ReportService

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _tmp(suffix: str) -> str:
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    return path


@router.get("/fee-collection.pdf")
def fee_collection_pdf(start: date, end: date, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    report = ReportService(db).fee_collection_report(start, end)
    path = pdf_reports.generate_fee_collection_report(_tmp(".pdf"), report)
    return FileResponse(path, media_type="application/pdf", filename="fee_collection_report.pdf")


@router.get("/fee-collection.xlsx")
def fee_collection_xlsx(start: date, end: date, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    report = ReportService(db).fee_collection_report(start, end)
    path = excel_reports.generate_fee_collection_excel(_tmp(".xlsx"), report)
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="fee_collection_report.xlsx",
    )


@router.get("/occupancy.pdf")
def occupancy_pdf(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    rows = ReportService(db).occupancy_report()
    path = pdf_reports.generate_occupancy_report(_tmp(".pdf"), rows)
    return FileResponse(path, media_type="application/pdf", filename="occupancy_report.pdf")


@router.get("/occupancy.xlsx")
def occupancy_xlsx(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    rows = ReportService(db).occupancy_report()
    path = excel_reports.generate_occupancy_excel(_tmp(".xlsx"), rows)
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="occupancy_report.xlsx",
    )


@router.get("/leave-log.pdf")
def leave_log_pdf(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    rows = ReportService(db).leave_log_report()
    path = pdf_reports.generate_leave_log_report(_tmp(".pdf"), rows)
    return FileResponse(path, media_type="application/pdf", filename="leave_log_report.pdf")


@router.get("/leave-log.xlsx")
def leave_log_xlsx(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    rows = ReportService(db).leave_log_report()
    path = excel_reports.generate_leave_log_excel(_tmp(".xlsx"), rows)
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="leave_log_report.xlsx",
    )


@router.get("/complaint-timeline.pdf")
def complaint_timeline_pdf(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    rows = ReportService(db).complaint_resolution_timeline()
    path = pdf_reports.generate_complaint_timeline_report(_tmp(".pdf"), rows)
    return FileResponse(path, media_type="application/pdf", filename="complaint_timeline_report.pdf")


@router.get("/complaint-timeline.xlsx")
def complaint_timeline_xlsx(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    rows = ReportService(db).complaint_resolution_timeline()
    path = excel_reports.generate_complaint_timeline_excel(_tmp(".xlsx"), rows)
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="complaint_timeline_report.xlsx",
    )


@router.get("/receipt/{feeid}.pdf")
def fee_receipt(feeid: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    from hms.repositories.repos import FeeRepository, StudentRepository
    from hms.services.exceptions import HMSNotFoundError

    fee = FeeRepository(db).get(feeid)
    if fee is None:
        raise HMSNotFoundError(f"Fee {feeid} not found")
    student = StudentRepository(db).get(fee.studentid)
    path = pdf_reports.generate_receipt(_tmp(".pdf"), fee=fee, student=student)
    return FileResponse(path, media_type="application/pdf", filename=f"receipt_{feeid}.pdf")
