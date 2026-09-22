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
