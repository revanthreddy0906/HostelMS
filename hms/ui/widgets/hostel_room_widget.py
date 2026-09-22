"""FR-HM-01/02, FR-RM-01: hostel blocks & room management."""
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QFormLayout, QLineEdit, QPushButton,
    QTableWidget, QTableWidgetItem, QComboBox, QSpinBox, QLabel
)

from hms.services.room_service import HostelService, RoomService
from hms.ui.session_context import UISession, run_action


class HostelRoomWidget(QWidget):
    def __init__(self, ui_session: UISession):
        super().__init__()
        self.ui_session = ui_session
        self.hostel_service = HostelService(ui_session.db)
        self.room_service = RoomService(ui_session.db)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<b>Hostel Blocks</b>"))
        self.hostel_table = QTableWidget(0, 4)
        self.hostel_table.setHorizontalHeaderLabels(["ID", "Name", "Gender Type", "Maintenance Status"])
        layout.addWidget(self.hostel_table)

        hostel_form = QFormLayout()
        self.hostel_name_edit = QLineEdit()
        self.hostel_gender_combo = QComboBox()
        self.hostel_gender_combo.addItems(["Male", "Female", "Mixed"])
        self.hostel_totalrooms_spin = QSpinBox()
        self.hostel_totalrooms_spin.setRange(1, 500)
        hostel_form.addRow("Hostel Name:", self.hostel_name_edit)
        hostel_form.addRow("Gender Type:", self.hostel_gender_combo)
        hostel_form.addRow("Total Rooms:", self.hostel_totalrooms_spin)
        layout.addLayout(hostel_form)
        create_hostel_btn = QPushButton("Create Hostel Block")
        create_hostel_btn.clicked.connect(self.create_hostel)
        layout.addWidget(create_hostel_btn)

        layout.addWidget(QLabel("<b>Rooms</b>"))
        self.room_table = QTableWidget(0, 6)
        self.room_table.setHorizontalHeaderLabels(["ID", "Hostel", "Room No", "Type", "Capacity", "Occupied"])
        layout.addWidget(self.room_table)

        room_form = QFormLayout()
        self.room_hostel_combo = QComboBox()
        self.room_number_edit = QLineEdit()
        self.room_type_combo = QComboBox()
        self.room_type_combo.addItems(["AC", "Non-AC", "Deluxe"])
        self.room_capacity_spin = QSpinBox()
        self.room_capacity_spin.setRange(1, 10)
        room_form.addRow("Hostel:", self.room_hostel_combo)
        room_form.addRow("Room Number:", self.room_number_edit)
        room_form.addRow("Room Type:", self.room_type_combo)
        room_form.addRow("Capacity:", self.room_capacity_spin)
        layout.addLayout(room_form)
        create_room_btn = QPushButton("Create Room")
        create_room_btn.clicked.connect(self.create_room)
        layout.addWidget(create_room_btn)

        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self.refresh)
        layout.addWidget(refresh_btn)

        self.refresh()

    def refresh(self):
        hostels = self.hostel_service.list_hostels()
        self.hostel_table.setRowCount(len(hostels))
        self.room_hostel_combo.clear()
        for row, h in enumerate(hostels):
            self.hostel_table.setItem(row, 0, QTableWidgetItem(str(h.hostelid)))
            self.hostel_table.setItem(row, 1, QTableWidgetItem(h.hostelname))
            self.hostel_table.setItem(row, 2, QTableWidgetItem(h.gendertype))
            self.hostel_table.setItem(row, 3, QTableWidgetItem(h.maintenancestatus or ""))
            self.room_hostel_combo.addItem(h.hostelname, h.hostelid)

        rooms = self.room_service.list_rooms()
        self.room_table.setRowCount(len(rooms))
        hostel_names = {h.hostelid: h.hostelname for h in hostels}
        for row, r in enumerate(rooms):
            self.room_table.setItem(row, 0, QTableWidgetItem(str(r.roomid)))
            self.room_table.setItem(row, 1, QTableWidgetItem(hostel_names.get(r.hostelid, "")))
            self.room_table.setItem(row, 2, QTableWidgetItem(r.roomnumber))
            self.room_table.setItem(row, 3, QTableWidgetItem(r.roomtype))
            self.room_table.setItem(row, 4, QTableWidgetItem(str(r.capacity)))
            self.room_table.setItem(row, 5, QTableWidgetItem(str(r.occupiedbeds)))

    def create_hostel(self):
        result = run_action(
            self, self.ui_session, self.hostel_service.create_hostel, self.ui_session.current_user,
            hostelname=self.hostel_name_edit.text().strip(),
            gendertype=self.hostel_gender_combo.currentText(),
            totalrooms=self.hostel_totalrooms_spin.value(),
            success_message="Hostel created",
        )
        if result is not None:
            self.refresh()

    def create_room(self):
        hostelid = self.room_hostel_combo.currentData()
        if hostelid is None:
            return
        result = run_action(
            self, self.ui_session, self.room_service.create_room, self.ui_session.current_user,
            hostelid=hostelid,
            roomnumber=self.room_number_edit.text().strip(),
            capacity=self.room_capacity_spin.value(),
            roomtype=self.room_type_combo.currentText(),
            success_message="Room created",
        )
        if result is not None:
            self.refresh()
