"""
Main application window: role-specific sidebar/dashboard per SRS §4.1.

Each role sees only the tabs relevant to its permissions; the service layer
still separately enforces RBAC (defense in depth), so even a modified/rogue
UI cannot bypass access control.
"""
from PySide6.QtWidgets import QMainWindow, QTabWidget, QWidget, QVBoxLayout, QLabel, QPushButton, QHBoxLayout

from hms.ui.session_context import UISession
from hms.ui.widgets.student_widget import StudentAdminWidget, StudentProfileWidget
from hms.ui.widgets.hostel_room_widget import HostelRoomWidget
from hms.ui.widgets.allocation_widget import AllocationWidget
from hms.ui.widgets.fee_widget import FeeAdminWidget, FeeStudentWidget
from hms.ui.widgets.attendance_widget import AttendanceWidget
from hms.ui.widgets.leave_widget import LeaveStudentWidget, LeaveWardenWidget, LeaveSecurityWidget
from hms.ui.widgets.complaint_widget import ComplaintStudentWidget, ComplaintStaffWidget
from hms.ui.widgets.visitor_widget import VisitorWidget
from hms.ui.widgets.reports_widget import ReportsWidget
from hms.ui.widgets.staff_widget import StaffWidget


class MainWindow(QMainWindow):
    def __init__(self, ui_session: UISession, on_logout):
        super().__init__()
        self.ui_session = ui_session
        self.on_logout = on_logout
        role = ui_session.current_user.role

        self.setWindowTitle(f"HMS - {ui_session.current_user.username} ({role})")
        self.resize(1000, 700)

        central = QWidget()
        outer_layout = QVBoxLayout(central)

        header = QHBoxLayout()
        header.addWidget(QLabel(f"<b>Logged in as:</b> {ui_session.current_user.username} ({role})"))
        header.addStretch()
        logout_btn = QPushButton("Logout")
        logout_btn.clicked.connect(self.logout)
        header.addWidget(logout_btn)
        outer_layout.addLayout(header)

        self.tabs = QTabWidget()
        outer_layout.addWidget(self.tabs)
        self.setCentralWidget(central)

        self._build_tabs(role)

    def _build_tabs(self, role: str):
        if role == "Admin":
            self.tabs.addTab(StudentAdminWidget(self.ui_session), "Students")
            self.tabs.addTab(StaffWidget(self.ui_session), "Staff")
            self.tabs.addTab(HostelRoomWidget(self.ui_session), "Hostels & Rooms")
            self.tabs.addTab(AllocationWidget(self.ui_session), "Allocations")
            self.tabs.addTab(FeeAdminWidget(self.ui_session), "Fees")
            self.tabs.addTab(AttendanceWidget(self.ui_session), "Attendance")
            self.tabs.addTab(LeaveWardenWidget(self.ui_session), "Leave Approvals")
            self.tabs.addTab(ComplaintStaffWidget(self.ui_session), "Complaints")
            self.tabs.addTab(VisitorWidget(self.ui_session), "Visitors")
            self.tabs.addTab(ReportsWidget(self.ui_session), "Reports")

        elif role == "Warden":
            self.tabs.addTab(HostelRoomWidget(self.ui_session), "Hostels & Rooms")
            self.tabs.addTab(AllocationWidget(self.ui_session), "Allocations")
            self.tabs.addTab(AttendanceWidget(self.ui_session), "Attendance")
            self.tabs.addTab(LeaveWardenWidget(self.ui_session), "Leave Approvals")
            self.tabs.addTab(ComplaintStaffWidget(self.ui_session), "Complaints")
            self.tabs.addTab(ReportsWidget(self.ui_session), "Reports")

        elif role == "Staff":
            self.tabs.addTab(ComplaintStaffWidget(self.ui_session), "Complaints")
            self.tabs.addTab(VisitorWidget(self.ui_session), "Visitors")
            self.tabs.addTab(LeaveSecurityWidget(self.ui_session), "Gate Pass / Exit-Entry Log")
            self.tabs.addTab(AttendanceWidget(self.ui_session), "Attendance")

        elif role == "Student":
            self.tabs.addTab(StudentProfileWidget(self.ui_session), "My Profile")
            self.tabs.addTab(FeeStudentWidget(self.ui_session), "My Fees")
            self.tabs.addTab(LeaveStudentWidget(self.ui_session), "My Leave")
            self.tabs.addTab(ComplaintStudentWidget(self.ui_session), "My Complaints")

    def logout(self):
        self.ui_session.current_user = None
        self.close()
        self.on_logout()
