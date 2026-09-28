import os
from datetime import date

from hms.services.report_service import ReportService
from hms.services.fee_service import FeeService
from hms.services.allocation_service import AllocationService
from hms.reports import pdf_reports, excel_reports
from tests.helpers import make_admin, make_hostel_and_room, make_student


def _setup_fee(session, admin):
    hostel, room = make_hostel_and_room(session, admin, gendertype="Male", monthlyrent=40000)
    student = make_student(session, admin, roll="RG1", gender="Male")
    AllocationService(session).auto_allocate(admin, student.studentid, date(2026, 12, 1))  # raises the ₹3,000 deposit
    FeeService(session).generate_monthly_rent(admin, "2026-12")
    return student


def test_fee_collection_report_and_pdf_excel(session, tmp_path):
    admin = make_admin(session)
    _setup_fee(session, admin)

    report_service = ReportService(session)
    report = report_service.fee_collection_report(admin, date(2026, 1, 1), date(2026, 12, 31))
    assert report["total_due"] == 43000.00  # December rent + security deposit
    assert len(report["rows"]) == 2

    pdf_path = str(tmp_path / "fee_report.pdf")
    pdf_reports.generate_fee_collection_report(pdf_path, report)
    assert os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 0

    xlsx_path = str(tmp_path / "fee_report.xlsx")
    excel_reports.generate_fee_collection_excel(xlsx_path, report)
    assert os.path.exists(xlsx_path) and os.path.getsize(xlsx_path) > 0


def test_occupancy_report_and_exports(session, tmp_path):
    admin = make_admin(session)
    _setup_fee(session, admin)
    report_service = ReportService(session)
    rows = report_service.occupancy_report(admin)
    assert len(rows) >= 1

    pdf_path = str(tmp_path / "occ.pdf")
    pdf_reports.generate_occupancy_report(pdf_path, rows)
    assert os.path.exists(pdf_path)

    xlsx_path = str(tmp_path / "occ.xlsx")
    excel_reports.generate_occupancy_excel(xlsx_path, rows)
    assert os.path.exists(xlsx_path)


def test_receipt_generation(session, tmp_path):
    admin = make_admin(session)
    student = _setup_fee(session, admin)
    fee_service = FeeService(session)
    fee = next(f for f in fee_service.list_fees_for_student(admin, student.studentid) if f.billtype == "Rent")
    paid_fee = fee_service.pay_fee(admin, fee.feeid, 40000.00)

    receipt_path = str(tmp_path / "receipt.pdf")
    pdf_reports.generate_receipt(receipt_path, fee=paid_fee, student=student)
    assert os.path.exists(receipt_path) and os.path.getsize(receipt_path) > 0
