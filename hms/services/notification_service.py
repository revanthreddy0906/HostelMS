"""
Mocked notification service.

The SRS calls for SMS/Email notifications to parents/guardians (e.g. on leave
approval, FR-LM-02). No real third-party SMS/Email credentials are available
in this environment, so notifications are mocked behind this clean interface
and simply logged to console + logs/notifications.log. Swapping in a real
Twilio/SendGrid-backed implementation later only requires implementing this
interface -- no caller changes needed.
"""
import datetime
from abc import ABC, abstractmethod

from hms.config import NOTIFICATIONS_LOG


class NotificationService(ABC):
    @abstractmethod
    def send(self, to: str, subject: str, message: str) -> None:
        ...


class FileNotificationService(NotificationService):
    """Logs to console and appends to logs/notifications.log."""

    def send(self, to: str, subject: str, message: str) -> None:
        timestamp = datetime.datetime.utcnow().isoformat()
        line = f"[{timestamp}] TO={to} SUBJECT={subject!r} MESSAGE={message!r}"
        print(f"[MOCK NOTIFICATION] {line}")
        with open(NOTIFICATIONS_LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")


class ConsoleNotificationService(NotificationService):
    """Console-only variant, useful for tests where file I/O is undesirable."""

    def send(self, to: str, subject: str, message: str) -> None:
        print(f"[MOCK NOTIFICATION] TO={to} SUBJECT={subject!r} MESSAGE={message!r}")


default_notification_service: NotificationService = FileNotificationService()
