"""
Visitor management service.

FR-VM-01: staff logs visitor entry incl. name/contact/host student/entry time.
FR-VM-02: enforce configurable max visiting hours; flag overstaying visitors
          on a security dashboard view (config.MAX_VISITING_HOURS).
"""
from datetime import datetime

from sqlalchemy.orm import Session

from hms.config import MAX_VISITING_HOURS
from hms.models.models import Visitor
from hms.repositories.repos import VisitorRepository, StudentRepository
from hms.services.exceptions import HMSValidationError, HMSNotFoundError
from hms.services.rbac import CurrentUser, ensure_self_or_role, require_role


class VisitorService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = VisitorRepository(session)
        self.student_repo = StudentRepository(session)

    @require_role("Staff", "Admin")
    def log_entry(
        self, current_user: CurrentUser, visitorname: str, studentid: int, relationship: str,
        contactnumber: str | None = None,
    ) -> Visitor:
        student = self.student_repo.get(studentid)
        if student is None:
            raise HMSNotFoundError(f"Student {studentid} not found")
        visitor = Visitor(
            visitorname=visitorname,
            studentid=studentid,
            relationship_=relationship,
            contactnumber=contactnumber,
            intime=datetime.utcnow(),
        )
        return self.repo.add(visitor)

    @require_role("Staff", "Admin")
    def log_exit(self, current_user: CurrentUser, visitorid: int) -> Visitor:
        visitor = self.repo.get(visitorid)
        if visitor is None:
            raise HMSNotFoundError(f"Visitor {visitorid} not found")
        if visitor.outtime is not None:
            raise HMSValidationError("Visitor has already checked out")
        visitor.outtime = datetime.utcnow()
        self.session.flush()
        return visitor

    @require_role("Staff", "Warden", "Admin")
    def security_dashboard(self, current_user: CurrentUser) -> list[dict]:
        """FR-VM-02: active visitors, flagged if overstaying MAX_VISITING_HOURS."""
        now = datetime.utcnow()
        rows = []
        for visitor in self.repo.list_active():
            hours_in = (now - visitor.intime).total_seconds() / 3600.0
            rows.append(
                {
                    "visitorid": visitor.visitorid,
                    "visitorname": visitor.visitorname,
                    "studentid": visitor.studentid,
                    "intime": visitor.intime,
                    "hours_in": round(hours_in, 2),
                    "overstaying": hours_in > MAX_VISITING_HOURS,
                }
            )
        return rows

    def list_for_student(self, current_user: CurrentUser, studentid: int):
        ensure_self_or_role(current_user, studentid, "Staff", "Warden", "Admin")
        return self.repo.list_by_student(studentid)
