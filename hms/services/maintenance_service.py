"""
Maintenance / repair requests (PG overview document §15), separate from complaints.

A student reports a physical problem in their room. The request is
automatically assigned to the least-loaded staff member whose designation
handles that category (FR-CM-02's automatic assignment now lives here);
the admin or warden can reassign or reject it.
  Status:   Pending -> Assigned -> In Progress -> Resolved, or Rejected
  Priority: Low / Medium / High / Emergency
"""
from datetime import datetime

from sqlalchemy.orm import Session

from hms.models.models import MaintenanceRequest
from hms.repositories.repos import AllocationRepository, MaintenanceRepository, StaffRepository, StudentRepository
from hms.services.exceptions import HMSNotFoundError, HMSPermissionError, HMSValidationError
from hms.services.rbac import CurrentUser, require_role
from hms.services.student_service import MAX_PHOTO_CHARS

CATEGORY_TO_DESIGNATION = {
    "Fan": "Technician",
    "Geyser": "Technician",
    "Electrical socket": "Technician",
    "Lights": "Technician",
    "AC": "Technician",
    "Wi-Fi": "Technician",
    "Door": "Maintenance",
    "Lock": "Maintenance",
    "Window": "Maintenance",
    "Water leakage": "Maintenance",
    "Bathroom": "Maintenance",
    "Plumbing": "Maintenance",
    "Bed": "Maintenance",
    "Table": "Maintenance",
    "Chair": "Maintenance",
    "Other": "Maintenance",
}
CATEGORIES = list(CATEGORY_TO_DESIGNATION)
PRIORITIES = ["Low", "Medium", "High", "Emergency"]
# Allowed forward moves; Rejected is reachable only by Admin/Warden before work starts.
NEXT = {"Assigned": {"In Progress"}, "In Progress": {"Resolved"}}


class MaintenanceService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = MaintenanceRepository(session)
        self.staff_repo = StaffRepository(session)
        self.student_repo = StudentRepository(session)
        self.allocation_repo = AllocationRepository(session)

    def _auto_assign(self, category: str, hostelid: int | None) -> int | None:
        """Least-loaded staff with the matching designation, preferring staff assigned to the same block."""
        designation = CATEGORY_TO_DESIGNATION.get(category, "Maintenance")
        candidates = self.staff_repo.list_by_designation(designation) or self.staff_repo.list_by_designation("Maintenance")
        if not candidates:
            return None
        same_block = [s for s in candidates if s.assignedblock == hostelid]
        pool = same_block or candidates
        return min(pool, key=lambda s: (self.repo.count_open_for_staff(s.staffid), s.staffid)).staffid

    def _get(self, requestid: int) -> MaintenanceRequest:
        request = self.repo.get(requestid)
        if request is None:
            raise HMSNotFoundError(f"Maintenance request {requestid} not found")
        return request

    @require_role("Student")
    def create(
        self, current_user: CurrentUser, category: str, description: str, priority: str = "Medium", photo: str | None = None
    ) -> MaintenanceRequest:
        if category not in CATEGORY_TO_DESIGNATION:
            raise HMSValidationError(f"category must be one of {CATEGORIES}")
        if priority not in PRIORITIES:
            raise HMSValidationError(f"priority must be one of {PRIORITIES}")
        if not description.strip():
            raise HMSValidationError("Describe the problem")
        if photo and len(photo) > MAX_PHOTO_CHARS:
            raise HMSValidationError("Photo is too large (max about 500 KB)")
        allocation = self.allocation_repo.active_for_student(current_user.entity_id)
        staffid = self._auto_assign(category, allocation.room.hostelid if allocation else None)
        return self.repo.add(
            MaintenanceRequest(
                studentid=current_user.entity_id,
                roomid=allocation.roomid if allocation else None,
                category=category,
                description=description.strip(),
                priority=priority,
                photo=photo,
                assignedstaffid=staffid,
                status="Assigned" if staffid else "Pending",
            )
        )

    @require_role("Student")
    def list_mine(self, current_user: CurrentUser):
        return self.repo.list_by_student(current_user.entity_id)

    @require_role("Admin", "Warden", "Staff")
    def list_all(self, current_user: CurrentUser):
        requests = self.repo.list_all_ordered()
        if current_user.role == "Staff":
            return [r for r in requests if r.assignedstaffid == current_user.entity_id]
        return requests

    @require_role("Admin", "Warden")
    def assign(self, current_user: CurrentUser, requestid: int, staffid: int) -> MaintenanceRequest:
        request = self._get(requestid)
        if request.status in ("Resolved", "Rejected"):
            raise HMSValidationError(f"Request is already {request.status.lower()}")
        if self.staff_repo.get(staffid) is None:
            raise HMSNotFoundError(f"Staff {staffid} not found")
        request.assignedstaffid = staffid
        if request.status == "Pending":
            request.status = "Assigned"
        request.updatedat = datetime.utcnow()
        self.session.flush()
        return request

    @require_role("Admin", "Warden", "Staff")
    def update_status(self, current_user: CurrentUser, requestid: int, new_status: str, note: str | None = None) -> MaintenanceRequest:
        request = self._get(requestid)
        if current_user.role == "Staff" and request.assignedstaffid != current_user.entity_id:
            raise HMSPermissionError("Only the assigned staff member can update this request")
        if new_status == "Rejected":
            if current_user.role == "Staff":
                raise HMSPermissionError("Only an admin or warden can reject a request")
            if request.status not in ("Pending", "Assigned"):
                raise HMSValidationError("Only requests that haven't started can be rejected")
            if not (note or "").strip():
                raise HMSValidationError("Give a reason for rejecting")
        elif new_status not in NEXT.get(request.status, set()):
            raise HMSValidationError(f"Cannot move from '{request.status}' to '{new_status}'")
        request.status = new_status
        if note and note.strip():
            request.resolutionnote = note.strip()
        request.updatedat = datetime.utcnow()
        self.session.flush()
        return request
