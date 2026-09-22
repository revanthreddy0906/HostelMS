"""Admin: create Staff/Warden accounts (supports FR-HM-01 warden assignment, FR-CM-02 auto-assignment pool)."""
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QFormLayout, QLineEdit, QPushButton,
    QTableWidget, QTableWidgetItem, QComboBox, QLabel, QSpinBox
)

from hms.services.staff_service import StaffService
from hms.services.room_service import HostelService
from hms.ui.session_context import UISession, run_action


class StaffWidget(QWidget):
    def __init__(self, ui_session: UISession):
        super().__init__()
        self.ui_session = ui_session
        self.service = StaffService(ui_session.db)
        self.hostel_service = HostelService(ui_session.db)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<b>Staff</b>"))
        self.table = QTableWidget(0, 5)
        self.table.setHorizontalHeaderLabels(["ID", "Name", "Designation", "Assigned Block", "Role"])
        layout.addWidget(self.table)

        form = QFormLayout()
        self.username_edit = QLineEdit()
        self.password_edit = QLineEdit()
        self.fullname_edit = QLineEdit()
        self.designation_edit = QLineEdit()
        self.hostel_combo = QComboBox()
        self.role_combo = QComboBox()
        self.role_combo.addItems(["Staff", "Warden"])
        form.addRow("Username:", self.username_edit)
        form.addRow("Password:", self.password_edit)
        form.addRow("Full Name:", self.fullname_edit)
        form.addRow("Designation:", self.designation_edit)
        form.addRow("Assigned Block:", self.hostel_combo)
        form.addRow("Login Role:", self.role_combo)
        layout.addLayout(form)

        create_btn = QPushButton("Create Staff")
        create_btn.clicked.connect(self.create_staff)
        layout.addWidget(create_btn)

        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self.refresh)
        layout.addWidget(refresh_btn)

        self.refresh()

    def refresh(self):
        hostels = self.hostel_service.list_hostels()
        hostel_names = {h.hostelid: h.hostelname for h in hostels}
        self.hostel_combo.clear()
        for h in hostels:
            self.hostel_combo.addItem(h.hostelname, h.hostelid)

        staff_list = run_action(self, self.ui_session, self.service.list_staff, self.ui_session.current_user)
        if staff_list is None:
            return
        self.table.setRowCount(len(staff_list))
        for row, s in enumerate(staff_list):
            self.table.setItem(row, 0, QTableWidgetItem(str(s.staffid)))
            self.table.setItem(row, 1, QTableWidgetItem(s.fullname))
            self.table.setItem(row, 2, QTableWidgetItem(s.designation))
            self.table.setItem(row, 3, QTableWidgetItem(hostel_names.get(s.assignedblock, "")))
            self.table.setItem(row, 4, QTableWidgetItem(""))

    def create_staff(self):
        hostelid = self.hostel_combo.currentData()
        if hostelid is None:
            return
        result = run_action(
            self, self.ui_session, self.service.create_staff, self.ui_session.current_user,
            username=self.username_edit.text().strip(),
            plain_password=self.password_edit.text(),
            fullname=self.fullname_edit.text().strip(),
            designation=self.designation_edit.text().strip(),
            assignedblock=hostelid,
            role=self.role_combo.currentText(),
            success_message="Staff created",
        )
        if result is not None:
            self.refresh()
