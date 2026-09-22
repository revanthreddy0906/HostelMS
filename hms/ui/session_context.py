"""
A single long-lived SQLAlchemy session shared by the UI for the duration of
the application, with explicit commit()/rollback() wrapping around each
service call site (see run_action below). This keeps the UI layer thin: it
never contains business logic, only calls into hms/services and renders the
result or the caught HMSError message.
"""
from PySide6.QtWidgets import QMessageBox

from hms.db import SessionLocal
from hms.services.exceptions import HMSError


class UISession:
    """Holds the shared SQLAlchemy Session and the logged-in CurrentUser."""

    def __init__(self):
        self.db = SessionLocal()
        self.current_user = None


def run_action(parent_widget, ui_session: UISession, func, *args, success_message: str | None = None, **kwargs):
    """
    Executes a service-layer call, committing on success and rolling back on
    any HMSError (permission / validation / not-found / capacity), showing
    the error to the user via a QMessageBox rather than crashing the app.
    Returns the function's result, or None on failure.
    """
    try:
        result = func(*args, **kwargs)
        ui_session.db.commit()
        if success_message:
            QMessageBox.information(parent_widget, "Success", success_message)
        return result
    except HMSError as exc:
        ui_session.db.rollback()
        QMessageBox.warning(parent_widget, "Action failed", str(exc))
        return None
    except Exception as exc:  # unexpected -- still don't crash the UI
        ui_session.db.rollback()
        QMessageBox.critical(parent_widget, "Unexpected error", str(exc))
        return None
