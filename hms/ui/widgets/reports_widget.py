"""FR-RG-01/02: fee/occupancy/leave/complaint reports, exported to PDF and Excel."""
from datetime import date

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QPushButton, QDateEdit, QLabel, QFileDialog, QMessageBox
)
from PySide6.QtCore import QDate

from hms.services.report_service import ReportService
from hms.reports import pdf_reports, excel_reports
from hms.ui.session_context import UISession


class ReportsWidget(QWidget):
    def __init__(self, ui_session: UISession):
        super().__init__()
        self.ui_session = ui_session
        self.service = ReportService(ui_session.db)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<b>Reports</b>"))

        period_row = QHBoxLayout()
        self.start_edit = QDateEdit()
        self.start_edit.setCalendarPopup(True)
        self.start_edit.setDate(QDate.currentDate().addMonths(-6))
        self.end_edit = QDateEdit()
        self.end_edit.setCalendarPopup(True)
        self.end_edit.setDate(QDate.currentDate().addMonths(6))
        period_row.addWidget(QLabel("Fee report period:"))
        period_row.addWidget(self.start_edit)
        period_row.addWidget(self.end_edit)
        layout.addLayout(period_row)

        fee_row = QHBoxLayout()
        fee_pdf_btn = QPushButton("Fee Collection Report (PDF)")
        fee_pdf_btn.clicked.connect(self.export_fee_pdf)
        fee_xlsx_btn = QPushButton("Fee Collection Report (Excel)")
        fee_xlsx_btn.clicked.connect(self.export_fee_excel)
        fee_row.addWidget(fee_pdf_btn)
        fee_row.addWidget(fee_xlsx_btn)
        layout.addLayout(fee_row)

        occ_row = QHBoxLayout()
        occ_pdf_btn = QPushButton("Occupancy Report (PDF)")
        occ_pdf_btn.clicked.connect(self.export_occupancy_pdf)
        occ_xlsx_btn = QPushButton("Occupancy Report (Excel)")
        occ_xlsx_btn.clicked.connect(self.export_occupancy_excel)
        occ_row.addWidget(occ_pdf_btn)
        occ_row.addWidget(occ_xlsx_btn)
        layout.addLayout(occ_row)

        leave_row = QHBoxLayout()
        leave_pdf_btn = QPushButton("Leave Log Report (PDF)")
        leave_pdf_btn.clicked.connect(self.export_leave_pdf)
        leave_xlsx_btn = QPushButton("Leave Log Report (Excel)")
        leave_xlsx_btn.clicked.connect(self.export_leave_excel)
        leave_row.addWidget(leave_pdf_btn)
        leave_row.addWidget(leave_xlsx_btn)
        layout.addLayout(leave_row)

        complaint_row = QHBoxLayout()
        complaint_pdf_btn = QPushButton("Complaint Timeline Report (PDF)")
        complaint_pdf_btn.clicked.connect(self.export_complaint_pdf)
        complaint_xlsx_btn = QPushButton("Complaint Timeline Report (Excel)")
        complaint_xlsx_btn.clicked.connect(self.export_complaint_excel)
        complaint_row.addWidget(complaint_pdf_btn)
        complaint_row.addWidget(complaint_xlsx_btn)
        layout.addLayout(complaint_row)

    def _save_path(self, default_name, filter_str):
        path, _ = QFileDialog.getSaveFileName(self, "Save Report", default_name, filter_str)
        return path

    def export_fee_pdf(self):
        report = self.service.fee_collection_report(self.start_edit.date().toPython(), self.end_edit.date().toPython())
        path = self._save_path("fee_collection_report.pdf", "PDF Files (*.pdf)")
        if path:
            pdf_reports.generate_fee_collection_report(path, report)
            QMessageBox.information(self, "Report", f"Saved to {path}")

    def export_fee_excel(self):
        report = self.service.fee_collection_report(self.start_edit.date().toPython(), self.end_edit.date().toPython())
        path = self._save_path("fee_collection_report.xlsx", "Excel Files (*.xlsx)")
        if path:
            excel_reports.generate_fee_collection_excel(path, report)
            QMessageBox.information(self, "Report", f"Saved to {path}")

    def export_occupancy_pdf(self):
        rows = self.service.occupancy_report()
        path = self._save_path("occupancy_report.pdf", "PDF Files (*.pdf)")
        if path:
            pdf_reports.generate_occupancy_report(path, rows)
            QMessageBox.information(self, "Report", f"Saved to {path}")

    def export_occupancy_excel(self):
        rows = self.service.occupancy_report()
        path = self._save_path("occupancy_report.xlsx", "Excel Files (*.xlsx)")
        if path:
            excel_reports.generate_occupancy_excel(path, rows)
            QMessageBox.information(self, "Report", f"Saved to {path}")

    def export_leave_pdf(self):
        rows = self.service.leave_log_report()
        path = self._save_path("leave_log_report.pdf", "PDF Files (*.pdf)")
        if path:
            pdf_reports.generate_leave_log_report(path, rows)
            QMessageBox.information(self, "Report", f"Saved to {path}")

    def export_leave_excel(self):
        rows = self.service.leave_log_report()
        path = self._save_path("leave_log_report.xlsx", "Excel Files (*.xlsx)")
        if path:
            excel_reports.generate_leave_log_excel(path, rows)
            QMessageBox.information(self, "Report", f"Saved to {path}")

    def export_complaint_pdf(self):
        rows = self.service.complaint_resolution_timeline()
        path = self._save_path("complaint_timeline_report.pdf", "PDF Files (*.pdf)")
        if path:
            pdf_reports.generate_complaint_timeline_report(path, rows)
            QMessageBox.information(self, "Report", f"Saved to {path}")

    def export_complaint_excel(self):
        rows = self.service.complaint_resolution_timeline()
        path = self._save_path("complaint_timeline_report.xlsx", "Excel Files (*.xlsx)")
        if path:
            excel_reports.generate_complaint_timeline_excel(path, rows)
            QMessageBox.information(self, "Report", f"Saved to {path}")
