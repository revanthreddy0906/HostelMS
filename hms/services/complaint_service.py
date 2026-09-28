"""
Complaints and feedback (PG overview document §16; replaces FR-CM-01's lists,
recorded in docs/SRS_AMBIGUITIES.md).

Complaints cover issues that don't need a physical repair (repairs go to
MaintenanceService, which now carries FR-CM-02's automatic staff assignment).
  Categories: Food / Mess, Cleanliness, Water, Wi-Fi, Hostel Facilities,
              Administration, Noise, Suggestions, Other
  Status:     Pending -> Reviewed -> In Progress -> Resolved (forward only)
Food feedback (category Food / Mess) can carry a meal, date and 1-5 rating.
Anonymous complaints keep the student link for their own "My complaints"
list, but staff views never see who raised them.
"""
from datetime import date

from sqlalchemy.orm import Session

from hms.models.models import Complaint
from hms.repositories.repos import ComplaintRepository, StudentRepository
from hms.services.exceptions import HMSNotFoundError, HMSValidationError
from hms.services.rbac import CurrentUser, require_role

VALID_CATEGORIES = [
    "Food / Mess",
    "Cleanliness",
    "Water",
    "Wi-Fi",
    "Hostel Facilities",
    "Administration",
    "Noise",
    "Suggestions",
    "Other",
]
VALID_STATUSES = ["Pending", "Reviewed", "In Progress", "Resolved"]
MEALS = {"Breakfast", "Lunch", "Dinner"}


class ComplaintService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = ComplaintRepository(session)
        self.student_repo = StudentRepository(session)

    @require_role("Student")
    def register_complaint(
        self,
        current_user: CurrentUser,
        category: str,
        description: str,
        *,
        meal: str | None = None,
        mealdate: date | None = None,
        rating: int | None = None,
        isanonymous: bool = False,
    ) -> Complaint:
        if category not in VALID_CATEGORIES:
            raise HMSValidationError(f"category must be one of {VALID_CATEGORIES}")
        if not description.strip():
            raise HMSValidationError("Describe the issue")
        if category != "Food / Mess" and (meal or mealdate or rating):
            raise HMSValidationError("Meal, date and rating apply to Food / Mess feedback only")
        if meal is not None and meal not in MEALS:
            raise HMSValidationError(f"meal must be one of {sorted(MEALS)}")
        if rating is not None and not 1 <= rating <= 5:
            raise HMSValidationError("rating must be between 1 and 5")
        if mealdate is not None and mealdate > date.today():
            raise HMSValidationError("Feedback can only be given for a meal already served")
        student = self.student_repo.get(current_user.entity_id)
        if student is None:
            raise HMSNotFoundError("Student profile not found for current user")
        return self.repo.add(
            Complaint(
                studentid=student.studentid,
                category=category,
                description=description.strip(),
                status="Pending",
                meal=meal,
                mealdate=mealdate,
                rating=rating,
                isanonymous=isanonymous,
            )
        )

    @require_role("Admin", "Warden", "Staff")
    def update_status(self, current_user: CurrentUser, complaintid: int, new_status: str) -> Complaint:
        if new_status not in VALID_STATUSES:
            raise HMSValidationError(f"status must be one of {VALID_STATUSES}")
        complaint = self.repo.get(complaintid)
        if complaint is None:
            raise HMSNotFoundError(f"Complaint {complaintid} not found")
        if VALID_STATUSES.index(new_status) < VALID_STATUSES.index(complaint.status):
            raise HMSValidationError(f"Cannot move status backwards from '{complaint.status}' to '{new_status}'")
        complaint.status = new_status
        self.session.flush()
        return complaint

    @require_role("Student")
    def list_mine(self, current_user: CurrentUser):
        return self.repo.list_by_student(current_user.entity_id)

    @require_role("Staff", "Warden", "Admin")
    def list_all(self, current_user: CurrentUser):
        return self.repo.list_all_ordered()

    @staticmethod
    def view(complaint: Complaint, reveal_student: bool) -> dict:
        """API shape; anonymous complaints hide the student from everyone but the author."""
        hide = complaint.isanonymous and not reveal_student
        return {
            "complaintid": complaint.complaintid,
            "studentid": None if hide else complaint.studentid,
            "category": complaint.category,
            "description": complaint.description,
            "status": complaint.status,
            "createdat": complaint.createdat,
            "meal": complaint.meal,
            "mealdate": complaint.mealdate,
            "rating": complaint.rating,
            "isanonymous": complaint.isanonymous,
        }
