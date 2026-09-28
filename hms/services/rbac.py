"""
Role-based access control, enforced at the service layer.

Roles are exactly the schema's 4 values: Student, Warden, Staff, Admin
(Login.role). The SRS §2.3 names 5 user classes (Admin, Warden, Student,
Accountant, Hostel Staff); "Accountant" and "Hostel Staff" duties are mapped
onto the Staff/Admin roles. This is a documented, resolved ambiguity -- see
docs/SRS_AMBIGUITIES.md.
"""
from functools import wraps

from hms.services.exceptions import HMSPermissionError


class CurrentUser:
    """Lightweight session-state object representing the logged-in user."""

    def __init__(self, userid: int, username: str, role: str, entity_id: int | None = None):
        self.userid = userid
        self.username = username
        self.role = role
        # entity_id: studentid/staffid/adminid of the logged-in person, resolved at login
        self.entity_id = entity_id

    def __repr__(self):
        return f"CurrentUser(userid={self.userid}, username={self.username!r}, role={self.role!r})"


def ensure_self_or_role(current_user: CurrentUser, studentid: int, *allowed_roles: str) -> None:
    """Allow a Student to reach only their own studentid; any other caller must hold one of allowed_roles.

    entity_id is only a studentid for Student logins (for Warden/Staff it is a staffid), so the
    ownership match is checked for Students alone.
    """
    if current_user is not None and current_user.role == "Student" and current_user.entity_id == studentid:
        return
    if current_user is None or current_user.role not in allowed_roles:
        raise HMSPermissionError(
            f"Role '{getattr(current_user, 'role', None)}' may not access records of student {studentid}"
        )


def require_role(*allowed_roles: str):
    """Decorator for service methods: first positional arg (after self) must be a CurrentUser."""

    def decorator(func):
        @wraps(func)
        def wrapper(self, current_user: CurrentUser, *args, **kwargs):
            if current_user is None or current_user.role not in allowed_roles:
                raise HMSPermissionError(
                    f"Role '{getattr(current_user, 'role', None)}' is not permitted to call "
                    f"{func.__name__}(); requires one of {allowed_roles}"
                )
            return func(self, current_user, *args, **kwargs)

        return wrapper

    return decorator
