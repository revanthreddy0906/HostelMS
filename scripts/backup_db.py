"""
Simple SQLite backup utility.

Implements the SRS §4.4 reliability requirement (daily backups, 30-day
retention) for the SQLite demo engine: copies hms.db into backups/ with a
timestamped filename, and prunes backups older than 30 days. This script is
NOT itself a scheduler -- in a real deployment it would be invoked by cron /
Task Scheduler / systemd timer. See docs/NFR_DISPOSITION.md ("Partially
implemented").

Run with: python scripts/backup_db.py
"""
import os
import shutil
import sys
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hms.config import BASE_DIR, BACKUP_DIR, DATABASE_URL

RETENTION_DAYS = 30


def backup_sqlite_db():
    if not DATABASE_URL.startswith("sqlite"):
        print("Backup script only supports the default SQLite engine; "
              "use your DBMS's native backup tooling for Postgres/MySQL.")
        return None

    db_path = DATABASE_URL.replace("sqlite:///", "")
    if not os.path.isabs(db_path):
        db_path = os.path.join(BASE_DIR, db_path)
    if not os.path.exists(db_path):
        print(f"No database file found at {db_path}; nothing to back up.")
        return None

    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(BACKUP_DIR, f"hms_backup_{timestamp}.db")
    shutil.copy2(db_path, backup_path)
    print(f"Backed up {db_path} -> {backup_path}")

    _prune_old_backups()
    return backup_path


def _prune_old_backups():
    cutoff = time.time() - RETENTION_DAYS * 86400
    for fname in os.listdir(BACKUP_DIR):
        fpath = os.path.join(BACKUP_DIR, fname)
        if os.path.isfile(fpath) and os.path.getmtime(fpath) < cutoff:
            os.remove(fpath)
            print(f"Pruned old backup: {fpath}")


if __name__ == "__main__":
    backup_sqlite_db()
