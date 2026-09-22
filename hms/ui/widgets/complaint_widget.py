"""FR-CM-01/02: complaint registration, auto-assignment, status tracking."""
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QFormLayout, QPushButton,
    QTableWidget, QTableWidgetItem, QComboBox, QTextEdit, QLabel, QSpinBox
)

from hms.services.complaint_service import ComplaintService, VALID_CATEGORIES, VALID_STATUSES
from hms.ui.session_context import UISession, run_action


class ComplaintStudentWidget(QWidget):
    def __init__(self, ui_session: UISession):
        super().__init__()
        self.ui_session = ui_session
        self.service = ComplaintService(ui_session.db)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<b>Register Complaint</b>"))
        form = QFormLayout()
        self.category_combo = QComboBox()
        self.category_combo.addItems(sorted(VALID_CATEGORIES))
        self.description_edit = QTextEdit()
        self.description_edit.setMaximumHeight(60)
        form.addRow("Category:", self.category_combo)
        form.addRow("Description:", self.description_edit)
        layout.addLayout(form)
        submit_btn = QPushButton("Submit")
        submit_btn.clicked.connect(self.submit)
        layout.addWidget(submit_btn)

        layout.addWidget(QLabel("<b>My Complaints</b>"))
        self.table = QTableWidget(0, 4)
        self.table.setHorizontalHeaderLabels(["ID", "Category", "Status", "Assigned Staff"])
        layout.addWidget(self.table)
        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self.refresh)
        layout.addWidget(refresh_btn)
        self.refresh()

    def submit(self):
        result = run_action(
            self, self.ui_session, self.service.register_complaint, self.ui_session.current_user,
            self.category_combo.currentText(), self.description_edit.toPlainText().strip(),
            success_message="Complaint registered",
        )
        if result is not None:
            self.refresh()

    def refresh(self):
        studentid = self.ui_session.current_user.entity_id
        complaints = self.service.list_for_student(studentid)
        self.table.setRowCount(len(complaints))
        for row, c in enumerate(complaints):
            self.table.setItem(row, 0, QTableWidgetItem(str(c.complaintid)))
            self.table.setItem(row, 1, QTableWidgetItem(c.category))
            self.table.setItem(row, 2, QTableWidgetItem(c.status))
            self.table.setItem(row, 3, QTableWidgetItem(str(c.assignedstaffid or "-")))


class ComplaintStaffWidget(QWidget):
    """Staff/Warden/Admin view: all complaints, update status."""

    def __init__(self, ui_session: UISession):
        super().__init__()
        self.ui_session = ui_session
        self.service = ComplaintService(ui_session.db)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<b>All Complaints</b>"))
        self.table = QTableWidget(0, 5)
        self.table.setHorizontalHeaderLabels(["ID", "Student ID", "Category", "Status", "Assigned Staff"])
        layout.addWidget(self.table)

        update_row = QHBoxLayout()
        self.complaintid_spin = QSpinBox()
        self.complaintid_spin.setRange(1, 999999)
        self.status_combo = QComboBox()
        self.status_combo.addItems(VALID_STATUSES)
        update_row.addWidget(QLabel("Complaint ID:"))
        update_row.addWidget(self.complaintid_spin)
        update_row.addWidget(QLabel("New Status:"))
        update_row.addWidget(self.status_combo)
        update_btn = QPushButton("Update Status")
        update_btn.clicked.connect(self.update_status)
        update_row.addWidget(update_btn)
        layout.addLayout(update_row)

        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self.refresh)
        layout.addWidget(refresh_btn)
        self.refresh()

    def refresh(self):
        complaints = self.service.list_all()
        self.table.setRowCount(len(complaints))
        for row, c in enumerate(complaints):
            self.table.setItem(row, 0, QTableWidgetItem(str(c.complaintid)))
            self.table.setItem(row, 1, QTableWidgetItem(str(c.studentid)))
            self.table.setItem(row, 2, QTableWidgetItem(c.category))
            self.table.setItem(row, 3, QTableWidgetItem(c.status))
            self.table.setItem(row, 4, QTableWidgetItem(str(c.assignedstaffid or "-")))

    def update_status(self):
        result = run_action(
            self, self.ui_session, self.service.update_status, self.ui_session.current_user,
            self.complaintid_spin.value(), self.status_combo.currentText(), success_message="Status updated",
        )
        if result is not None:
            self.refresh()
