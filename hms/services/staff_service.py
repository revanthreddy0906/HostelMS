"""Staff management service (Admin creates staff/warden accounts)."""
from sqlalchemy.orm import Session

from hms.models.models import Staff
from hms.repositories.repos import StaffRepository
from hms.services.auth_service import AuthService
from hms.services.exceptions import HMSNotFoundError
from hms.services.rbac import CurrentUser, require_role


class StaffService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = StaffRepository(session)
        self.auth = AuthService(session)

    @require_role("Admin")
    def create_staff(
        self,
        current_user: CurrentUser,
        *,
        username: str,
        plain_password: str,
        fullname: str,
        designation: str,
        assignedblock: int,
        role: str = "Staff",
    ) -> Staff:
        login = self.auth.create_login(username, plain_password, role=role)
        staff = Staff(userid=login.userid, fullname=fullname, designation=designation, assignedblock=assignedblock)
        return self.repo.add(staff)

    @require_role("Admin")
    def list_staff(self, current_user: CurrentUser):
        return self.repo.list_all()

    @require_role("Admin")
    def get_staff(self, current_user: CurrentUser, staffid: int) -> Staff:
        staff = self.repo.get(staffid)
        if staff is None:
            raise HMSNotFoundError(f"Staff {staffid} not found")
        return staff
