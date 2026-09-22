"""FR-LM-01/02/03 + SRS §7.3: leave application, approval, gate pass, exit/entry log."""
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QFormLayout, QLineEdit, QPushButton,
    QTableWidget, QTableWidgetItem, QDateEdit, QLabel, QTextEdit, QSpinBox, QFileDialog
)
from PySide6.QtCore import QDate
from PySide6.QtGui import QPixmap

from hms.services.leave_service import LeaveService
from hms.ui.session_context import UISession, run_action


class LeaveStudentWidget(QWidget):
    def __init__(self, ui_session: UISession):
        super().__init__()
        self.ui_session = ui_session
        self.service = LeaveService(ui_session.db)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<b>Apply for Leave</b>"))
        form = QFormLayout()
        self.start_edit = QDateEdit()
        self.start_edit.setCalendarPopup(True)
        self.start_edit.setDate(QDate.currentDate())
        self.end_edit = QDateEdit()
        self.end_edit.setCalendarPopup(True)
        self.end_edit.setDate(QDate.currentDate().addDays(1))
        self.reason_edit = QTextEdit()
        self.reason_edit.setMaximumHeight(60)
        form.addRow("Start Date:", self.start_edit)
        form.addRow("End Date:", self.end_edit)
        form.addRow("Reason:", self.reason_edit)
        layout.addLayout(form)
        apply_btn = QPushButton("Apply")
        apply_btn.clicked.connect(self.apply_leave)
        layout.addWidget(apply_btn)

        layout.addWidget(QLabel("<b>My Leave Requests</b>"))
        self.table = QTableWidget(0, 5)
        self.table.setHorizontalHeaderLabels(["Leave ID", "Start", "End", "Status", "Gate Pass"])
        layout.addWidget(self.table)

        qr_row = QHBoxLayout()
        self.qr_leaveid_edit = QLineEdit()
        qr_row.addWidget(QLabel("Leave ID for QR:"))
        qr_row.addWidget(self.qr_leaveid_edit)
        qr_btn = QPushButton("Save Gate Pass QR")
        qr_btn.clicked.connect(self.save_qr)
        qr_row.addWidget(qr_btn)
        layout.addLayout(qr_row)

        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self.refresh)
        layout.addWidget(refresh_btn)
        self.refresh()

    def apply_leave(self):
        start = self.start_edit.date().toPython()
        end = self.end_edit.date().toPython()
        reason = self.reason_edit.toPlainText().strip()
        result = run_action(
            self, self.ui_session, self.service.apply_leave, self.ui_session.current_user,
            start, end, reason, success_message="Leave application submitted",
        )
        if result is not None:
            self.refresh()

    def refresh(self):
        studentid = self.ui_session.current_user.entity_id
        leaves = self.service.list_for_student(studentid)
        self.table.setRowCount(len(leaves))
        for row, l in enumerate(leaves):
            self.table.setItem(row, 0, QTableWidgetItem(str(l.leaveid)))
            self.table.setItem(row, 1, QTableWidgetItem(str(l.startdate)))
            self.table.setItem(row, 2, QTableWidgetItem(str(l.enddate)))
            self.table.setItem(row, 3, QTableWidgetItem(l.status))
            self.table.setItem(row, 4, QTableWidgetItem(l.gatepasscode or "-"))

    def save_qr(self):
        try:
            leaveid = int(self.qr_leaveid_edit.text().strip())
        except ValueError:
            return
        try:
            png_bytes = self.service.get_gatepass_qr(leaveid)
        except Exception as exc:
            from PySide6.QtWidgets import QMessageBox
            QMessageBox.warning(self, "Gate Pass", str(exc))
            return
        path, _ = QFileDialog.getSaveFileName(self, "Save Gate Pass QR", f"gatepass_{leaveid}.png", "PNG Files (*.png)")
        if path:
            with open(path, "wb") as f:
                f.write(png_bytes)


class LeaveWardenWidget(QWidget):
    """Warden: approve/reject pending leave requests."""

    def __init__(self, ui_session: UISession):
        super().__init__()
        self.ui_session = ui_session
        self.service = LeaveService(ui_session.db)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<b>Pending Leave Requests</b>"))
        self.table = QTableWidget(0, 4)
        self.table.setHorizontalHeaderLabels(["Leave ID", "Student ID", "Start", "End"])
        layout.addWidget(self.table)

        decide_row = QHBoxLayout()
        self.leaveid_spin = QSpinBox()
        self.leaveid_spin.setRange(1, 999999)
        decide_row.addWidget(QLabel("Leave ID:"))
        decide_row.addWidget(self.leaveid_spin)
        approve_btn = QPushButton("Approve")
        approve_btn.clicked.connect(lambda: self.decide(True))
        reject_btn = QPushButton("Reject")
        reject_btn.clicked.connect(lambda: self.decide(False))
        decide_row.addWidget(approve_btn)
        decide_row.addWidget(reject_btn)
        layout.addLayout(decide_row)

        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self.refresh)
        layout.addWidget(refresh_btn)
        self.refresh()

    def refresh(self):
        pending = self.service.list_pending()
        self.table.setRowCount(len(pending))
        for row, l in enumerate(pending):
            self.table.setItem(row, 0, QTableWidgetItem(str(l.leaveid)))
            self.table.setItem(row, 1, QTableWidgetItem(str(l.studentid)))
            self.table.setItem(row, 2, QTableWidgetItem(str(l.startdate)))
            self.table.setItem(row, 3, QTableWidgetItem(str(l.enddate)))

    def decide(self, approve: bool):
        result = run_action(
            self, self.ui_session, self.service.decide_leave, self.ui_session.current_user,
            self.leaveid_spin.value(), approve,
            success_message="Leave decision recorded" + (" and gate pass generated" if approve else ""),
        )
        if result is not None:
            self.refresh()


class LeaveSecurityWidget(QWidget):
    """Staff/Security: scan/enter gate pass code and log exit/entry."""

    def __init__(self, ui_session: UISession):
        super().__init__()
        self.ui_session = ui_session
        self.service = LeaveService(ui_session.db)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<b>Gate Pass Exit / Entry Log</b>"))
        form = QFormLayout()
        self.code_edit = QLineEdit()
        self.studentid_spin = QSpinBox()
        self.studentid_spin.setRange(1, 999999)
        form.addRow("Gate Pass Code:", self.code_edit)
        form.addRow("Student ID:", self.studentid_spin)
        layout.addLayout(form)

        button_row = QHBoxLayout()
        exit_btn = QPushButton("Log Exit")
        exit_btn.clicked.connect(self.log_exit)
        entry_btn = QPushButton("Log Entry")
        entry_btn.clicked.connect(self.log_entry)
        button_row.addWidget(exit_btn)
        button_row.addWidget(entry_btn)
        layout.addLayout(button_row)

    def log_exit(self):
        run_action(
            self, self.ui_session, self.service.log_exit, self.ui_session.current_user,
            self.code_edit.text().strip(), self.studentid_spin.value(), success_message="Exit logged",
        )

    def log_entry(self):
        run_action(
            self, self.ui_session, self.service.log_entry, self.ui_session.current_user,
            self.code_edit.text().strip(), self.studentid_spin.value(), success_message="Entry logged",
        )
