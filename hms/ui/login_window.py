"""Login screen -- Authentication & Authorization (bcrypt + session state)."""
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QFormLayout, QLineEdit, QPushButton, QLabel, QMessageBox
)
from PySide6.QtCore import Qt

from hms.services.auth_service import AuthService
from hms.services.exceptions import AuthenticationError
from hms.ui.session_context import UISession


class LoginWindow(QWidget):
    def __init__(self, ui_session: UISession, on_success):
        super().__init__()
        self.ui_session = ui_session
        self.on_success = on_success
        self.setWindowTitle("HMS - Login")
        self.resize(360, 200)

        layout = QVBoxLayout(self)
        title = QLabel("Hostel Management System")
        title.setAlignment(Qt.AlignCenter)
        title.setStyleSheet("font-size: 16px; font-weight: bold;")
        layout.addWidget(title)

        form = QFormLayout()
        self.username_edit = QLineEdit()
        self.password_edit = QLineEdit()
        self.password_edit.setEchoMode(QLineEdit.Password)
        form.addRow("Username:", self.username_edit)
        form.addRow("Password:", self.password_edit)
        layout.addLayout(form)

        self.login_button = QPushButton("Login")
        self.login_button.clicked.connect(self.attempt_login)
        layout.addWidget(self.login_button)
        self.password_edit.returnPressed.connect(self.attempt_login)

    def attempt_login(self):
        username = self.username_edit.text().strip()
        password = self.password_edit.text()
        if not username or not password:
            QMessageBox.warning(self, "Login", "Enter both username and password")
            return
        auth = AuthService(self.ui_session.db)
        try:
            current_user = auth.login(username, password)
            self.ui_session.db.commit()
            self.ui_session.current_user = current_user
            self.on_success()
        except AuthenticationError as exc:
            self.ui_session.db.rollback()
            QMessageBox.warning(self, "Login failed", str(exc))
