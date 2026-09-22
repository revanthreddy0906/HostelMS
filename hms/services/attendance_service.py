"""
Attendance service.

FR-AM-01: daily attendance marking by warden/staff.
FR-AM-02: flag students absent N consecutive days and surface an alert list
          for the warden (threshold: config.CONSECUTIVE_ABSENT_ALERT_DAYS).
"""
from datetime import date, timedelta

from sqlalchemy.orm import Session

from hms.config import CONSECUTIVE_ABSENT_ALERT_DAYS
from hms.models.models import Attendance
from hms.repositories.repos import AttendanceRepository, StudentRepository
from hms.services.exceptions import HMSValidationError, HMSNotFoundError
from hms.services.rbac import CurrentUser, require_role

VALID_STATUSES = {"Present", "Absent", "On Leave"}


class AttendanceService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = AttendanceRepository(session)
        self.student_repo = StudentRepository(session)

    @require_role("Warden", "Staff", "Admin")
    def mark_attendance(
        self, current_user: CurrentUser, studentid: int, on_date: date, status: str
    ) -> Attendance:
        if status not in VALID_STATUSES:
            raise HMSValidationError(f"status must be one of {VALID_STATUSES}")
        student = self.student_repo.get(studentid)
        if student is None:
            raise HMSNotFoundError(f"Student {studentid} not found")
        existing = self.repo.get_for_date(studentid, on_date)
        if existing:
            existing.status = status
            existing.markedby = current_user.userid
            self.session.flush()
            return existing
        record = Attendance(studentid=studentid, date=on_date, status=status, markedby=current_user.userid)
        return self.repo.add(record)

    def list_for_date(self, on_date: date):
        return self.repo.list_for_date(on_date)

    @require_role("Warden", "Admin")
    def consecutive_absentee_alerts(
        self, current_user: CurrentUser, lookback_days: int = 30, threshold: int | None = None
    ) -> list[dict]:
        """Returns students absent for >= threshold consecutive days ending today."""
        threshold = threshold or CONSECUTIVE_ABSENT_ALERT_DAYS
        alerts = []
        for student in self.student_repo.list_all():
            records = self.repo.recent_for_student(student.studentid, lookback_days)
            records_by_date = {r.date: r.status for r in records}
            streak = 0
            day = date.today()
            while True:
                status = records_by_date.get(day)
                if status == "Absent":
                    streak += 1
                    day -= timedelta(days=1)
                else:
                    break
            if streak >= threshold:
                alerts.append(
                    {
                        "studentid": student.studentid,
                        "rollnumber": student.rollnumber,
                        "name": f"{student.firstname} {student.lastname}",
                        "consecutive_absent_days": streak,
                    }
                )
        return alerts
