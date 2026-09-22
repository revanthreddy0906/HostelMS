"""FR-VM-01/02: visitor entry/exit logging and overstay dashboard."""
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QFormLayout, QLineEdit, QPushButton,
    QTableWidget, QTableWidgetItem, QLabel, QSpinBox
)

from hms.services.visitor_service import VisitorService
from hms.ui.session_context import UISession, run_action


class VisitorWidget(QWidget):
    def __init__(self, ui_session: UISession):
        super().__init__()
        self.ui_session = ui_session
        self.service = VisitorService(ui_session.db)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<b>Log Visitor Entry</b>"))
        form = QFormLayout()
        self.name_edit = QLineEdit()
        self.studentid_spin = QSpinBox()
        self.studentid_spin.setRange(1, 999999)
        self.relationship_edit = QLineEdit()
        self.contact_edit = QLineEdit()
        form.addRow("Visitor Name:", self.name_edit)
        form.addRow("Host Student ID:", self.studentid_spin)
        form.addRow("Relationship:", self.relationship_edit)
        form.addRow("Contact Number:", self.contact_edit)
        layout.addLayout(form)
        entry_btn = QPushButton("Log Entry")
        entry_btn.clicked.connect(self.log_entry)
        layout.addWidget(entry_btn)

        layout.addWidget(QLabel("<b>Active Visitors (Security Dashboard)</b>"))
        self.table = QTableWidget(0, 6)
        self.table.setHorizontalHeaderLabels(["Visitor ID", "Name", "Student ID", "In Time", "Hours In", "Overstaying"])
        layout.addWidget(self.table)

        exit_row = QHBoxLayout()
        self.exit_visitorid_spin = QSpinBox()
        self.exit_visitorid_spin.setRange(1, 999999)
        exit_row.addWidget(QLabel("Visitor ID to check out:"))
        exit_row.addWidget(self.exit_visitorid_spin)
        exit_btn = QPushButton("Log Exit")
        exit_btn.clicked.connect(self.log_exit)
        exit_row.addWidget(exit_btn)
        layout.addLayout(exit_row)

        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self.refresh)
        layout.addWidget(refresh_btn)
        self.refresh()

    def log_entry(self):
        result = run_action(
            self, self.ui_session, self.service.log_entry, self.ui_session.current_user,
            self.name_edit.text().strip(), self.studentid_spin.value(), self.relationship_edit.text().strip(),
            contactnumber=self.contact_edit.text().strip(), success_message="Visitor entry logged",
        )
        if result is not None:
            self.refresh()

    def log_exit(self):
        result = run_action(
            self, self.ui_session, self.service.log_exit, self.ui_session.current_user,
            self.exit_visitorid_spin.value(), success_message="Visitor exit logged",
        )
        if result is not None:
            self.refresh()

    def refresh(self):
        rows = self.service.security_dashboard()
        self.table.setRowCount(len(rows))
        for row, v in enumerate(rows):
            self.table.setItem(row, 0, QTableWidgetItem(str(v["visitorid"])))
            self.table.setItem(row, 1, QTableWidgetItem(v["visitorname"]))
            self.table.setItem(row, 2, QTableWidgetItem(str(v["studentid"])))
            self.table.setItem(row, 3, QTableWidgetItem(str(v["intime"])))
            self.table.setItem(row, 4, QTableWidgetItem(str(v["hours_in"])))
            item = QTableWidgetItem("YES" if v["overstaying"] else "no")
            self.table.setItem(row, 5, item)
