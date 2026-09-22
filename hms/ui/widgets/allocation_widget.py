"""FR-RM-02/03: auto & manual room allocation, vacate, room change."""
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QFormLayout, QLineEdit, QPushButton,
    QTableWidget, QTableWidgetItem, QComboBox, QLabel, QSpinBox
)

from hms.services.allocation_service import AllocationService
from hms.repositories.repos import RoomRepository
from hms.ui.session_context import UISession, run_action


class AllocationWidget(QWidget):
    def __init__(self, ui_session: UISession):
        super().__init__()
        self.ui_session = ui_session
        self.service = AllocationService(ui_session.db)
        self.room_repo = RoomRepository(ui_session.db)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<b>Active Allocations</b>"))
        self.table = QTableWidget(0, 5)
        self.table.setHorizontalHeaderLabels(["Allocation ID", "Student ID", "Room ID", "Alloc. Date", "Status"])
        layout.addWidget(self.table)

        form = QFormLayout()
        self.studentid_spin = QSpinBox()
        self.studentid_spin.setRange(1, 999999)
        self.roomid_spin = QSpinBox()
        self.roomid_spin.setRange(1, 999999)
        form.addRow("Student ID:", self.studentid_spin)
        form.addRow("Room ID (manual only):", self.roomid_spin)
        layout.addLayout(form)

        button_row = QHBoxLayout()
        auto_btn = QPushButton("Auto-Allocate")
        auto_btn.clicked.connect(self.auto_allocate)
        manual_btn = QPushButton("Manual Allocate")
        manual_btn.clicked.connect(self.manual_allocate)
        change_btn = QPushButton("Change Room")
        change_btn.clicked.connect(self.change_room)
        button_row.addWidget(auto_btn)
        button_row.addWidget(manual_btn)
        button_row.addWidget(change_btn)
        layout.addLayout(button_row)

        vacate_row = QHBoxLayout()
        self.allocationid_spin = QSpinBox()
        self.allocationid_spin.setRange(1, 999999)
        vacate_row.addWidget(QLabel("Allocation ID to vacate:"))
        vacate_row.addWidget(self.allocationid_spin)
        vacate_btn = QPushButton("Vacate")
        vacate_btn.clicked.connect(self.vacate)
        vacate_row.addWidget(vacate_btn)
        layout.addLayout(vacate_row)

        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self.refresh)
        layout.addWidget(refresh_btn)

        self.refresh()

    def refresh(self):
        allocations = self.service.repo.list_active()
        self.table.setRowCount(len(allocations))
        for row, a in enumerate(allocations):
            self.table.setItem(row, 0, QTableWidgetItem(str(a.allocationid)))
            self.table.setItem(row, 1, QTableWidgetItem(str(a.studentid)))
            self.table.setItem(row, 2, QTableWidgetItem(str(a.roomid)))
            self.table.setItem(row, 3, QTableWidgetItem(str(a.allocationdate)))
            self.table.setItem(row, 4, QTableWidgetItem(a.status))

    def auto_allocate(self):
        result = run_action(
            self, self.ui_session, self.service.auto_allocate, self.ui_session.current_user,
            self.studentid_spin.value(), success_message="Student auto-allocated a room",
        )
        if result is not None:
            self.refresh()

    def manual_allocate(self):
        result = run_action(
            self, self.ui_session, self.service.manual_allocate, self.ui_session.current_user,
            self.studentid_spin.value(), self.roomid_spin.value(), success_message="Student manually allocated",
        )
        if result is not None:
            self.refresh()

    def change_room(self):
        result = run_action(
            self, self.ui_session, self.service.change_room, self.ui_session.current_user,
            self.studentid_spin.value(), self.roomid_spin.value(), success_message="Room changed (transferred)",
        )
        if result is not None:
            self.refresh()

    def vacate(self):
        result = run_action(
            self, self.ui_session, self.service.vacate, self.ui_session.current_user,
            self.allocationid_spin.value(), success_message="Allocation vacated",
        )
        if result is not None:
            self.refresh()
