"""Domain-level exceptions raised by the service layer.

The UI layer catches these and shows a message box; they are never silently
swallowed, and PermissionError-style access-control failures are raised as
HMSPermissionError so the RBAC checks are enforced regardless of which UI
(or test) is calling the service.
"""


class HMSError(Exception):
    """Base class for all domain errors."""


class HMSPermissionError(HMSError):
    """Raised when the acting role is not authorized for the requested action."""


class HMSValidationError(HMSError):
    """Raised on invalid input / business rule violation."""


class HMSNotFoundError(HMSError):
    """Raised when a referenced entity does not exist."""


class CapacityExceededError(HMSError):
    """Raised when a room allocation would exceed room capacity."""


class AuthenticationError(HMSError):
    """Raised on invalid login credentials or inactive account."""
