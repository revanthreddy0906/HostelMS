"""FR-FM-01/02/03: fee structures, generation, mocked payment, PDF receipts."""
import os
from datetime import date

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QFormLayout, QLineEdit, QPushButton,
    QTableWidget, QTableWidgetItem, QComboBox, QDoubleSpinBox, QDateEdit, QLabel, QFileDialog
)
from PySide6.QtCore import QDate

from hms.services.fee_service import FeeService
from hms.services.student_service import StudentService
from hms.reports.pdf_reports import generate_receipt
from hms.ui.session_context import UISession, run_action


class FeeAdminWidget(QWidget):
    def __init__(self, ui_session: UISession):
        super().__init__()
        self.ui_session = ui_session
        self.service = FeeService(ui_session.db)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<b>Fee Structures</b>"))
        struct_form = QFormLayout()
        self.roomtype_combo = QComboBox()
        self.roomtype_combo.addItems(["AC", "Non-AC", "Deluxe"])
        self.amount_spin = QDoubleSpinBox()
        self.amount_spin.setRange(0, 1_000_000)
        self.amount_spin.setDecimals(2)
        self.semester_edit = QLineEdit("Sem1-2026")
        struct_form.addRow("Room Type:", self.roomtype_combo)
        struct_form.addRow("Amount:", self.amount_spin)
        struct_form.addRow("Semester:", self.semester_edit)
        layout.addLayout(struct_form)
        set_struct_btn = QPushButton("Set/Update Fee Structure")
        set_struct_btn.clicked.connect(self.set_structure)
        layout.addWidget(set_struct_btn)

        gen_row = QHBoxLayout()
        self.duedate_edit = QDateEdit()
        self.duedate_edit.setCalendarPopup(True)
        self.duedate_edit.setDate(QDate.currentDate().addMonths(1))
        gen_row.addWidget(QLabel("Due Date:"))
        gen_row.addWidget(self.duedate_edit)
        gen_btn = QPushButton("Generate Fees for Active Allocations")
        gen_btn.clicked.connect(self.generate_fees)
        gen_row.addWidget(gen_btn)
        layout.addLayout(gen_row)

        overdue_btn = QPushButton("Mark Overdue Fees")
        overdue_btn.clicked.connect(self.mark_overdue)
        layout.addWidget(overdue_btn)

    def set_structure(self):
        run_action(
            self, self.ui_session, self.service.set_fee_structure, self.ui_session.current_user,
            self.roomtype_combo.currentText(), self.amount_spin.value(), self.semester_edit.text().strip(),
            success_message="Fee structure saved",
        )

    def generate_fees(self):
        duedate = self.duedate_edit.date().toPython()
        run_action(
            self, self.ui_session, self.service.generate_fees_for_active_allocations, self.ui_session.current_user,
            self.semester_edit.text().strip(), duedate, success_message="Fees generated for active allocations",
        )

    def mark_overdue(self):
        run_action(
            self, self.ui_session, self.service.mark_overdue, self.ui_session.current_user,
            success_message="Overdue fees updated",
        )


class FeeStudentWidget(QWidget):
    def __init__(self, ui_session: UISession):
        super().__init__()
        self.ui_session = ui_session
        self.service = FeeService(ui_session.db)
        self.student_service = StudentService(ui_session.db)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<b>My Fees</b>"))
        self.table = QTableWidget(0, 5)
        self.table.setHorizontalHeaderLabels(["Fee ID", "Due", "Paid", "Status", "Due Date"])
        layout.addWidget(self.table)

        pay_row = QHBoxLayout()
        self.feeid_edit = QLineEdit()
        self.amount_spin = QDoubleSpinBox()
        self.amount_spin.setRange(0, 1_000_000)
        self.amount_spin.setDecimals(2)
        pay_row.addWidget(QLabel("Fee ID:"))
        pay_row.addWidget(self.feeid_edit)
        pay_row.addWidget(QLabel("Amount:"))
        pay_row.addWidget(self.amount_spin)
        pay_btn = QPushButton("Pay Fee (mocked gateway)")
        pay_btn.clicked.connect(self.pay_fee)
        pay_row.addWidget(pay_btn)
        layout.addLayout(pay_row)

        receipt_btn = QPushButton("Download Receipt PDF for Fee ID")
        receipt_btn.clicked.connect(self.download_receipt)
        layout.addWidget(receipt_btn)

        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self.refresh)
        layout.addWidget(refresh_btn)

        self.refresh()

    def refresh(self):
        studentid = self.ui_session.current_user.entity_id
        fees = self.service.list_fees_for_student(studentid)
        self.table.setRowCount(len(fees))
        for row, f in enumerate(fees):
            self.table.setItem(row, 0, QTableWidgetItem(str(f.feeid)))
            self.table.setItem(row, 1, QTableWidgetItem(f"{float(f.amountdue):.2f}"))
            self.table.setItem(row, 2, QTableWidgetItem(f"{float(f.amountpaid):.2f}"))
            self.table.setItem(row, 3, QTableWidgetItem(f.paymentstatus))
            self.table.setItem(row, 4, QTableWidgetItem(str(f.duedate)))

    def pay_fee(self):
        try:
            feeid = int(self.feeid_edit.text().strip())
        except ValueError:
            return
        result = run_action(
            self, self.ui_session, self.service.pay_fee, self.ui_session.current_user,
            feeid, self.amount_spin.value(), success_message="Payment successful",
        )
        if result is not None:
            self.refresh()

    def download_receipt(self):
        try:
            feeid = int(self.feeid_edit.text().strip())
        except ValueError:
            return
        fee = self.service.repo.get(feeid)
        if fee is None:
            return
        student = self.student_service.get_student(fee.studentid)
        path, _ = QFileDialog.getSaveFileName(self, "Save Receipt", f"receipt_{feeid}.pdf", "PDF Files (*.pdf)")
        if path:
            generate_receipt(path, fee=fee, student=student)
