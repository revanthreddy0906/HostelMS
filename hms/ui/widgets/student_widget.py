"""FR-SM-01/02/03: student CRUD (Admin) and self-service profile update (Student)."""
from datetime import date

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QFormLayout, QLineEdit, QPushButton,
    QTableWidget, QTableWidgetItem, QComboBox, QDateEdit, QLabel, QMessageBox
)
from PySide6.QtCore import QDate

from hms.services.student_service import StudentService
from hms.ui.session_context import UISession, run_action


class StudentAdminWidget(QWidget):
    """Admin view: list all students, create new, apply approved critical changes."""

    def __init__(self, ui_session: UISession):
        super().__init__()
        self.ui_session = ui_session
        self.service = StudentService(ui_session.db)
        layout = QVBoxLayout(self)

        layout.addWidget(QLabel("<b>Students</b>"))
        self.table = QTableWidget(0, 6)
        self.table.setHorizontalHeaderLabels(["ID", "Roll No", "Name", "Gender", "Contact", "Guardian"])
        layout.addWidget(self.table)

        form_box = QHBoxLayout()
        form = QFormLayout()
        self.username_edit = QLineEdit()
        self.password_edit = QLineEdit()
        self.roll_edit = QLineEdit()
        self.first_edit = QLineEdit()
        self.last_edit = QLineEdit()
        self.gender_combo = QComboBox()
        self.gender_combo.addItems(["Male", "Female"])
        self.contact_edit = QLineEdit()
        self.guardian_edit = QLineEdit()
        self.dob_edit = QDateEdit()
        self.dob_edit.setCalendarPopup(True)
        self.dob_edit.setDate(QDate(2004, 1, 1))

        form.addRow("Username:", self.username_edit)
        form.addRow("Password:", self.password_edit)
        form.addRow("Roll Number:", self.roll_edit)
        form.addRow("First Name:", self.first_edit)
        form.addRow("Last Name:", self.last_edit)
        form.addRow("Gender:", self.gender_combo)
        form.addRow("Contact Phone:", self.contact_edit)
        form.addRow("Guardian Phone:", self.guardian_edit)
        form.addRow("Date of Birth:", self.dob_edit)
        form_box.addLayout(form)
        layout.addLayout(form_box)

        button_row = QHBoxLayout()
        self.create_button = QPushButton("Create Student")
        self.create_button.clicked.connect(self.create_student)
        self.refresh_button = QPushButton("Refresh")
        self.refresh_button.clicked.connect(self.refresh)
        button_row.addWidget(self.create_button)
        button_row.addWidget(self.refresh_button)
        layout.addLayout(button_row)

        self.refresh()

    def refresh(self):
        self.table.setRowCount(0)
        students = run_action(self, self.ui_session, self.service.list_students, self.ui_session.current_user)
        if students is None:
            return
        self.table.setRowCount(len(students))
        for row, s in enumerate(students):
            self.table.setItem(row, 0, QTableWidgetItem(str(s.studentid)))
            self.table.setItem(row, 1, QTableWidgetItem(s.rollnumber))
            self.table.setItem(row, 2, QTableWidgetItem(f"{s.firstname} {s.lastname}"))
            self.table.setItem(row, 3, QTableWidgetItem(s.gender))
            self.table.setItem(row, 4, QTableWidgetItem(s.contactphone))
            self.table.setItem(row, 5, QTableWidgetItem(s.guardianphone))

    def create_student(self):
        try:
            dob = self.dob_edit.date().toPython()
        except Exception:
            dob = date(2004, 1, 1)
        result = run_action(
            self, self.ui_session, self.service.create_student, self.ui_session.current_user,
            username=self.username_edit.text().strip(),
            plain_password=self.password_edit.text(),
            rollnumber=self.roll_edit.text().strip(),
            firstname=self.first_edit.text().strip(),
            lastname=self.last_edit.text().strip(),
            gender=self.gender_combo.currentText(),
            contactphone=self.contact_edit.text().strip(),
            guardianphone=self.guardian_edit.text().strip(),
            dateofbirth=dob,
            success_message="Student created",
        )
        if result is not None:
            self.refresh()


class StudentProfileWidget(QWidget):
    """Student self-service: view profile, update non-critical fields, request critical changes."""

    def __init__(self, ui_session: UISession):
        super().__init__()
        self.ui_session = ui_session
        self.service = StudentService(ui_session.db)
        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<b>My Profile</b>"))

        form = QFormLayout()
        self.contact_edit = QLineEdit()
        self.guardian_edit = QLineEdit()
        self.emergency_edit = QLineEdit()
        self.bloodgroup_edit = QLineEdit()
        self.medical_edit = QLineEdit()
        form.addRow("Contact Phone:", self.contact_edit)
        form.addRow("Guardian Phone:", self.guardian_edit)
        form.addRow("Emergency Contact:", self.emergency_edit)
        form.addRow("Blood Group:", self.bloodgroup_edit)
        form.addRow("Medical History:", self.medical_edit)
        layout.addLayout(form)

        save_button = QPushButton("Save Profile (self-editable fields)")
        save_button.clicked.connect(self.save_profile)
        layout.addWidget(save_button)

        layout.addWidget(QLabel("<b>Request Critical Change (requires Admin approval)</b>"))
        critical_form = QFormLayout()
        self.new_first_edit = QLineEdit()
        self.new_last_edit = QLineEdit()
        critical_form.addRow("New First Name:", self.new_first_edit)
        critical_form.addRow("New Last Name:", self.new_last_edit)
        layout.addLayout(critical_form)
        request_button = QPushButton("Submit Change Request")
        request_button.clicked.connect(self.request_change)
        layout.addWidget(request_button)

        self.load_profile()

    def load_profile(self):
        student = self.service.get_student(self.ui_session.current_user.entity_id)
        self.contact_edit.setText(student.contactphone or "")
        self.guardian_edit.setText(student.guardianphone or "")
        self.emergency_edit.setText(student.emergencycontact or "")
        self.bloodgroup_edit.setText(student.bloodgroup or "")
        self.medical_edit.setText(student.medicalhistory or "")

    def save_profile(self):
        result = run_action(
            self, self.ui_session, self.service.self_update_non_critical, self.ui_session.current_user,
            contactphone=self.contact_edit.text().strip(),
            guardianphone=self.guardian_edit.text().strip(),
            emergencycontact=self.emergency_edit.text().strip(),
            bloodgroup=self.bloodgroup_edit.text().strip(),
            medicalhistory=self.medical_edit.text().strip(),
            success_message="Profile updated",
        )
        if result is not None:
            self.load_profile()

    def request_change(self):
        fields = {}
        if self.new_first_edit.text().strip():
            fields["firstname"] = self.new_first_edit.text().strip()
        if self.new_last_edit.text().strip():
            fields["lastname"] = self.new_last_edit.text().strip()
        if not fields:
            QMessageBox.information(self, "Request Change", "Enter at least one field to change")
            return
        result = run_action(
            self, self.ui_session, self.service.request_critical_change, self.ui_session.current_user,
            **fields, success_message="Change request submitted for Admin approval",
        )
