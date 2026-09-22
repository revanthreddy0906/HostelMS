"""
Configuration for HMS.

The database engine URL is configurable via the HMS_DATABASE_URL environment
variable so the app can be pointed at Postgres 15+/MySQL 8.0+ per the SRS in
production, while defaulting to a local SQLite file for a runnable demo.
This is a documented deviation (see docs/COMPLIANCE_REPORT.md).
"""
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATABASE_URL = os.environ.get(
    "HMS_DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'hms.db')}"
)

LOG_DIR = os.path.join(BASE_DIR, "logs")
BACKUP_DIR = os.path.join(BASE_DIR, "backups")
NOTIFICATIONS_LOG = os.path.join(LOG_DIR, "notifications.log")

# bcrypt cost factor per SRS §4.4.3
BCRYPT_ROUNDS = 12

# Default seeded admin credentials (dev only). Override via env vars.
DEFAULT_ADMIN_USERNAME = os.environ.get("HMS_ADMIN_USERNAME", "admin")
DEFAULT_ADMIN_PASSWORD = os.environ.get("HMS_ADMIN_PASSWORD", "Admin@12345")

# FR-AM-02: consecutive absent days threshold that triggers a warden alert
CONSECUTIVE_ABSENT_ALERT_DAYS = int(os.environ.get("HMS_ABSENT_ALERT_DAYS", "3"))

# FR-VM-02: max visiting hours before a visitor is flagged as overstaying
MAX_VISITING_HOURS = float(os.environ.get("HMS_MAX_VISITING_HOURS", "3"))

os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(BACKUP_DIR, exist_ok=True)
