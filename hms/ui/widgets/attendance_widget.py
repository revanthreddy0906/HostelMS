"""FR-AM-01/02: daily attendance marking and consecutive-absentee alerts."""
from datetime import date

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QFormLayout, QPushButton,
    QTableWidget, QTableWidgetItem, QComboBox, QDateEdit, QLabel, QSpinBox
)
from PySide6.QtCore import QDate

from hms.services.attendance_service import AttendanceService
from hms.ui.session_context import UISession, run_action


class AttendanceWidget(QWidget):
    def __init__(self, ui_session: UISession):
        super().__init__()
        self.ui_session = ui_session
        self.service = AttendanceService(ui_session.db)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<b>Mark Attendance</b>"))
        mark_form = QFormLayout()
        self.studentid_spin = QSpinBox()
        self.studentid_spin.setRange(1, 999999)
        self.date_edit = QDateEdit()
        self.date_edit.setCalendarPopup(True)
        self.date_edit.setDate(QDate.currentDate())
        self.status_combo = QComboBox()
        self.status_combo.addItems(["Present", "Absent", "On Leave"])
        mark_form.addRow("Student ID:", self.studentid_spin)
        mark_form.addRow("Date:", self.date_edit)
        mark_form.addRow("Status:", self.status_combo)
        layout.addLayout(mark_form)
        mark_btn = QPushButton("Mark")
        mark_btn.clicked.connect(self.mark)
        layout.addWidget(mark_btn)

        layout.addWidget(QLabel("<b>Today's Attendance</b>"))
        self.table = QTableWidget(0, 4)
        self.table.setHorizontalHeaderLabels(["Attendance ID", "Student ID", "Date", "Status"])
        layout.addWidget(self.table)

        layout.addWidget(QLabel("<b>Consecutive Absentee Alerts</b>"))
        self.alert_table = QTableWidget(0, 3)
        self.alert_table.setHorizontalHeaderLabels(["Roll No", "Name", "Consecutive Absent Days"])
        layout.addWidget(self.alert_table)

        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self.refresh)
        layout.addWidget(refresh_btn)

        self.refresh()

    def mark(self):
        on_date = self.date_edit.date().toPython()
        result = run_action(
            self, self.ui_session, self.service.mark_attendance, self.ui_session.current_user,
            self.studentid_spin.value(), on_date, self.status_combo.currentText(),
            success_message="Attendance marked",
        )
        if result is not None:
            self.refresh()

    def refresh(self):
        records = self.service.list_for_date(date.today())
        self.table.setRowCount(len(records))
        for row, r in enumerate(records):
            self.table.setItem(row, 0, QTableWidgetItem(str(r.attendanceid)))
            self.table.setItem(row, 1, QTableWidgetItem(str(r.studentid)))
            self.table.setItem(row, 2, QTableWidgetItem(str(r.date)))
            self.table.setItem(row, 3, QTableWidgetItem(r.status))

        # Alert list is Warden/Admin-only (RBAC enforced in the service layer);
        # skip the call silently for other roles rather than popping a
        # permission-error dialog on every refresh.
        if self.ui_session.current_user.role in ("Warden", "Admin"):
            alerts = run_action(self, self.ui_session, self.service.consecutive_absentee_alerts, self.ui_session.current_user)
            if alerts is not None:
                self.alert_table.setRowCount(len(alerts))
                for row, a in enumerate(alerts):
                    self.alert_table.setItem(row, 0, QTableWidgetItem(a["rollnumber"]))
                    self.alert_table.setItem(row, 1, QTableWidgetItem(a["name"]))
                    self.alert_table.setItem(row, 2, QTableWidgetItem(str(a["consecutive_absent_days"])))
        else:
            self.alert_table.setRowCount(0)
