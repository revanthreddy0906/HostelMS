"""
Complaint management service.

FR-CM-01: student registers a complaint with a category.
FR-CM-02: auto-assignment to a responsible staff member. Rule (documented in
          docs/SRS_AMBIGUITIES.md): map category -> designation
          (Plumbing/Electrical/Cleaning -> 'Cleaner' or matching maintenance
          designation; Internet -> 'Technician'; Others -> 'Security'), then
          pick the least-loaded Staff member (fewest Open/In Progress
          complaints currently assigned) among that designation. Falls back
          to round-robin across all Staff if no designation match exists.
Status tracking: Open -> In Progress -> Resolved -> Closed.
"""
from sqlalchemy.orm import Session

from hms.models.models import Complaint
from hms.repositories.repos import ComplaintRepository, StaffRepository, StudentRepository
from hms.services.exceptions import HMSValidationError, HMSNotFoundError
from hms.services.rbac import CurrentUser, require_role

VALID_CATEGORIES = {"Plumbing", "Electrical", "Cleaning", "Internet", "Others"}
VALID_STATUSES = ["Open", "In Progress", "Resolved", "Closed"]

CATEGORY_TO_DESIGNATION = {
    "Plumbing": "Maintenance",
    "Electrical": "Maintenance",
    "Cleaning": "Cleaner",
    "Internet": "Technician",
    "Others": "Security",
}


class ComplaintService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = ComplaintRepository(session)
        self.staff_repo = StaffRepository(session)
        self.student_repo = StudentRepository(session)

    def _auto_assign_staff(self, category: str) -> int | None:
        designation = CATEGORY_TO_DESIGNATION.get(category)
        candidates = self.staff_repo.list_by_designation(designation) if designation else []
        if not candidates:
            candidates = self.staff_repo.list_all()
        if not candidates:
            return None
        # least-loaded: fewest currently open/in-progress complaints assigned
        best = min(candidates, key=lambda s: self.repo.count_open_for_staff(s.staffid))
        return best.staffid

    @require_role("Student")
    def register_complaint(self, current_user: CurrentUser, category: str, description: str) -> Complaint:
        if category not in VALID_CATEGORIES:
            raise HMSValidationError(f"category must be one of {VALID_CATEGORIES}")
        studentid = current_user.entity_id
        student = self.student_repo.get(studentid)
        if student is None:
            raise HMSNotFoundError("Student profile not found for current user")
        assigned_staffid = self._auto_assign_staff(category)
        complaint = Complaint(
            studentid=studentid,
            category=category,
            description=description,
            status="Open",
            assignedstaffid=assigned_staffid,
        )
        return self.repo.add(complaint)

    @require_role("Staff", "Admin", "Warden")
    def update_status(self, current_user: CurrentUser, complaintid: int, new_status: str) -> Complaint:
        if new_status not in VALID_STATUSES:
            raise HMSValidationError(f"status must be one of {VALID_STATUSES}")
        complaint = self.repo.get(complaintid)
        if complaint is None:
            raise HMSNotFoundError(f"Complaint {complaintid} not found")
        current_idx = VALID_STATUSES.index(complaint.status)
        new_idx = VALID_STATUSES.index(new_status)
        if new_idx < current_idx:
            raise HMSValidationError(
                f"Cannot move status backwards from '{complaint.status}' to '{new_status}'"
            )
        complaint.status = new_status
        self.session.flush()
        return complaint

    @require_role("Student")
    def list_mine(self, current_user: CurrentUser):
        return self.repo.list_by_student(current_user.entity_id)

    @require_role("Staff", "Warden", "Admin")
    def list_all(self, current_user: CurrentUser):
        return self.repo.list_all_ordered()
