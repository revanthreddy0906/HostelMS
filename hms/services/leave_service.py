"""
Leave / gate-pass service.

FR-LM-01: student applies for leave.
FR-LM-02: leave routes to warden; approval triggers a (mocked) notification
          to the guardian (guardianphone).
FR-LM-03: on approval, a QR-coded gate pass is generated (no dedicated table
          in the SRS -- derived from the approved Leave row; payload is
          f"{leaveid}:{checksum}" where checksum is an HMAC over leaveid+
          studentid+a server secret, verified at scan time). See
          docs/SRS_AMBIGUITIES.md.
SRS §7.3 chain: Leave apply -> Warden approve -> gate pass generated ->
                security exit log recorded (and, symmetrically, entry log on
                return) -- implemented end-to-end below.
"""
import hashlib
import hmac
import io
from datetime import date, datetime

import qrcode
from sqlalchemy.orm import Session

from hms.models.models import Leave
from hms.repositories.repos import LeaveRepository, StudentRepository
from hms.services.exceptions import HMSValidationError, HMSNotFoundError
from hms.services.notification_service import NotificationService, default_notification_service
from hms.services.rbac import CurrentUser, require_role

# Server-side secret for gate-pass checksum. In production this would come
# from a secrets manager / env var; a local dev default is fine here since
# gate passes are a demo convenience feature, not a security boundary.
_GATE_PASS_SECRET = b"hms-dev-gatepass-secret-change-in-prod"


def _checksum(leaveid: int, studentid: int) -> str:
    msg = f"{leaveid}:{studentid}".encode("utf-8")
    return hmac.new(_GATE_PASS_SECRET, msg, hashlib.sha256).hexdigest()[:16]


def make_gatepass_code(leaveid: int, studentid: int) -> str:
    return f"{leaveid}:{_checksum(leaveid, studentid)}"


def verify_gatepass_code(code: str, studentid: int) -> tuple[bool, int | None]:
    try:
        leaveid_str, checksum = code.split(":", 1)
        leaveid = int(leaveid_str)
    except (ValueError, AttributeError):
        return False, None
    expected = _checksum(leaveid, studentid)
    return hmac.compare_digest(checksum, expected), leaveid


def make_gatepass_qr_png(code: str) -> bytes:
    """Renders the gate-pass code as a QR PNG, returned as bytes."""
    img = qrcode.make(code)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class LeaveService:
    def __init__(self, session: Session, notification_service: NotificationService | None = None):
        self.session = session
        self.repo = LeaveRepository(session)
        self.student_repo = StudentRepository(session)
        self.notification_service = notification_service or default_notification_service

    @require_role("Student")
    def apply_leave(
        self, current_user: CurrentUser, startdate: date, enddate: date, reason: str
    ) -> Leave:
        if enddate < startdate:
            raise HMSValidationError("enddate cannot be before startdate")
        studentid = current_user.entity_id
        student = self.student_repo.get(studentid)
        if student is None:
            raise HMSNotFoundError("Student profile not found for current user")
        leave = Leave(
            studentid=studentid, startdate=startdate, enddate=enddate, reason=reason, status="Pending"
        )
        return self.repo.add(leave)

    @require_role("Warden", "Admin")
    def decide_leave(self, current_user: CurrentUser, leaveid: int, approve: bool) -> Leave:
        leave = self.repo.get(leaveid)
        if leave is None:
            raise HMSNotFoundError(f"Leave {leaveid} not found")
        if leave.status != "Pending":
            raise HMSValidationError(f"Leave {leaveid} has already been decided ({leave.status})")

        student = self.student_repo.get(leave.studentid)
        if approve:
            leave.status = "Approved"
            leave.approvedby = current_user.userid
            leave.gatepasscode = make_gatepass_code(leave.leaveid, leave.studentid)
            self.session.flush()
            if student:
                self.notification_service.send(
                    to=student.guardianphone,
                    subject="Leave Approved",
                    message=(
                        f"Leave for {student.firstname} {student.lastname} "
                        f"({leave.startdate} to {leave.enddate}) has been approved."
                    ),
                )
        else:
            leave.status = "Rejected"
            leave.approvedby = current_user.userid
            self.session.flush()
        return leave

    def get_gatepass_qr(self, leaveid: int) -> bytes:
        leave = self.repo.get(leaveid)
        if leave is None or leave.status != "Approved" or not leave.gatepasscode:
            raise HMSValidationError("No valid gate pass for this leave")
        return make_gatepass_qr_png(leave.gatepasscode)

    # --- Security screen: scan/enter pass code and log exit/entry (SRS §7.3) ---

    @require_role("Staff", "Admin")
    def log_exit(self, current_user: CurrentUser, gatepass_code: str, studentid: int) -> Leave:
        ok, leaveid = verify_gatepass_code(gatepass_code, studentid)
        if not ok or leaveid is None:
            raise HMSValidationError("Invalid or tampered gate pass code")
        leave = self.repo.get(leaveid)
        if leave is None or leave.status != "Approved":
            raise HMSValidationError("Gate pass does not correspond to an approved leave")
        if leave.studentid != studentid:
            raise HMSValidationError("Gate pass does not belong to this student")
        if leave.exitlogged is not None:
            raise HMSValidationError("Exit already logged for this leave")
        leave.exitlogged = datetime.utcnow()
        self.session.flush()
        return leave

    @require_role("Staff", "Admin")
    def log_entry(self, current_user: CurrentUser, gatepass_code: str, studentid: int) -> Leave:
        ok, leaveid = verify_gatepass_code(gatepass_code, studentid)
        if not ok or leaveid is None:
            raise HMSValidationError("Invalid or tampered gate pass code")
        leave = self.repo.get(leaveid)
        if leave is None or leave.status != "Approved":
            raise HMSValidationError("Gate pass does not correspond to an approved leave")
        if leave.exitlogged is None:
            raise HMSValidationError("Cannot log entry before an exit has been logged")
        if leave.entrylogged is not None:
            raise HMSValidationError("Entry already logged for this leave")
        leave.entrylogged = datetime.utcnow()
        self.session.flush()
        return leave

    def list_for_student(self, studentid: int):
        return self.repo.list_by_student(studentid)

    def list_pending(self):
        return self.repo.list_by_status("Pending")
