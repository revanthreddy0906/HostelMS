"""Authentication service: bcrypt hashing (cost 12 per SRS §4.4.3), login, session state."""
import bcrypt
from sqlalchemy.orm import Session

from hms.config import BCRYPT_ROUNDS
from hms.models.models import Login
from hms.repositories.repos import (
    LoginRepository,
    AdminRepository,
    StudentRepository,
    StaffRepository,
)
from hms.services.exceptions import AuthenticationError
from hms.services.rbac import CurrentUser


def hash_password(plain_password: str) -> str:
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    return bcrypt.hashpw(plain_password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


class AuthService:
    def __init__(self, session: Session):
        self.session = session
        self.login_repo = LoginRepository(session)
        self.admin_repo = AdminRepository(session)
        self.student_repo = StudentRepository(session)
        self.staff_repo = StaffRepository(session)

    def create_login(self, username: str, plain_password: str, role: str, status: str = "ACTIVE") -> Login:
        if self.login_repo.get_by_username(username) is not None:
            raise AuthenticationError(f"Username '{username}' already exists")
        login = Login(
            username=username,
            passwordhash=hash_password(plain_password),
            role=role,
            status=status,
        )
        return self.login_repo.add(login)

    def login(self, username: str, plain_password: str) -> CurrentUser:
        login = self.login_repo.get_by_username(username)
        if login is None:
            raise AuthenticationError("Invalid username or password")
        if login.status != "ACTIVE":
            raise AuthenticationError(f"Account is {login.status.lower()}; contact an administrator")
        if not verify_password(plain_password, login.passwordhash):
            raise AuthenticationError("Invalid username or password")

        entity_id = None
        if login.role == "Admin":
            admin = self.admin_repo.get_by_userid(login.userid)
            entity_id = admin.adminid if admin else None
        elif login.role == "Student":
            student = self.student_repo.get_by_userid(login.userid)
            entity_id = student.studentid if student else None
        elif login.role in ("Staff", "Warden"):
            staff = self.staff_repo.get_by_userid(login.userid)
            entity_id = staff.staffid if staff else None

        return CurrentUser(userid=login.userid, username=login.username, role=login.role, entity_id=entity_id)

    def change_password(self, userid: int, new_plain_password: str) -> None:
        login = self.login_repo.get(userid)
        if login is None:
            raise AuthenticationError("Unknown user")
        login.passwordhash = hash_password(new_plain_password)
        self.session.flush()
