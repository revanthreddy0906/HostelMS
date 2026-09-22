# Hostel Management System (HMS)

A native desktop Hostel Management System built in Python with PySide6 and
SQLAlchemy, implementing the attached SRS.

> **Naming note:** the original request said "Hotel Management System," but
> the SRS is unambiguously a **Hostel** Management System (students, wardens,
> out-passes, guardians, hostel blocks, roll numbers). Per the SRS-as-source-
> of-truth instruction, this project uses Hostel/Student/Warden vocabulary
> throughout. See `docs/SRS_AMBIGUITIES.md` §1 and `docs/COMPLIANCE_REPORT.md`.

## Architecture

```
hms/
  models/        SQLAlchemy ORM models -- 12 SRS tables + fee_structures
  db.py          Engine/session setup (config-driven URL; SQLite FK pragma)
  repositories/  Thin CRUD + query methods, one per aggregate
  services/      Business logic (auth, allocation, fee, attendance, leave,
                  complaint, visitor, report, notification*, payment*)
                  * = mocked external integrations
  reports/       reportlab PDF builders + openpyxl Excel builders
  ui/            PySide6 windows: login, main window (role-specific tabs),
                  one widget per module per role
scripts/
  seed_db.py     Creates schema + seeds demo data (admin, hostels, rooms,
                  staff, students, fees, complaint, leave)
  backup_db.py   Timestamped SQLite backup utility with 30-day pruning
tests/           pytest suite against the service/repository layer (headless,
                  no Qt) -- 36 tests covering every FR + the SRS §7.2 and
                  §7.3 named scenarios
docs/            Traceability matrix, SRS ambiguities, NFR disposition,
                  final compliance report
```

Layered dependency direction: `ui -> services -> repositories -> models`.
The UI never talks to the database directly; every screen goes through the
service layer, which enforces RBAC and business rules and is the only layer
covered by automated tests (Qt UI is verified manually, not by pytest).

## Requirements

- Python 3.10+ (developed and tested on 3.13)
- See `requirements.txt`: PySide6, SQLAlchemy, bcrypt, reportlab, openpyxl,
  qrcode[pil], pytest, pytest-cov

## Setup

```bash
cd HotelMS
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Seed the database

```bash
python scripts/seed_db.py
```

This creates `hms.db` (SQLite, in the project root) with:

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `Admin@12345` |
| Warden | `warden1` | `Warden@123` |
| Staff (Security) | `security1` | `Security@123` |
| Staff (Cleaner) | `cleaner1` | `Cleaner@123` |
| Staff (Maintenance) | `maint1` | `Maint@123` |
| Staff (Technician) | `tech1` | `Tech@123` |
| Student | `student1` .. `student4` | `Student@123` |

These are **documented dev-only defaults**, overridable via the
`HMS_ADMIN_USERNAME` / `HMS_ADMIN_PASSWORD` environment variables. They are
never hardcoded as a literal check anywhere in the auth logic -- they are
only ever used at seed time to create a normally-hashed (bcrypt cost 12)
Login row, exactly like every other account.

## Run the app

```bash
python -m hms
```

This opens the login window; log in with any of the seeded credentials
above to see that role's dashboard.

## Run the tests

```bash
pytest
# or with coverage:
pytest --cov=hms --cov-report=term-missing
```

36 tests, all passing, covering: bcrypt hashing, login/RBAC, student CRUD +
self-update approval gate, hostel/room creation, allocation atomicity
(including the SRS §7.2 rollback scenario and room-change transfer), fee
structure/generation/payment/receipt, attendance marking + consecutive-
absentee alerts, the full SRS §7.3 leave -> gate-pass -> exit/entry chain
(including a tampered-code rejection case), complaint auto-assignment +
status progression, visitor entry/exit + overstay flagging, and report
generation (PDF + Excel) for fee collection, occupancy, leave logs, and
complaint timelines. **The Qt UI itself is verified manually** (see
`docs/COMPLIANCE_REPORT.md`), not by this automated suite -- every service/
repository module is deliberately kept free of PySide6 imports so `pytest`
runs fully headless.

## Back up the database

```bash
python scripts/backup_db.py
```

Copies `hms.db` into `backups/` with a timestamp and prunes backups older
than 30 days. This is a utility, not a scheduler -- see
`docs/NFR_DISPOSITION.md` for how the "daily backups" NFR is disposed.

## Switching the database engine

The SRS specifies Postgres 15+/MySQL 8.0+ in production. Set
`HMS_DATABASE_URL` to point at either before running `seed_db.py`:

```bash
export HMS_DATABASE_URL="postgresql+psycopg2://user:pass@host/hms"
# or
export HMS_DATABASE_URL="mysql+pymysql://user:pass@host/hms"
```

SQLite (the default, `sqlite:///hms.db`) requires no setup and is what the
demo above uses. See `docs/SRS_AMBIGUITIES.md` for the documented deviation
and the SQLite-specific `BIGINT PRIMARY KEY` quirk that was worked around.

## Documentation

- `docs/TRACEABILITY_MATRIX.md` -- all 20 FRs + auth mapped to service
  method, UI screen, DB table, and test.
- `docs/SRS_AMBIGUITIES.md` -- every ambiguity in the SRS and how it was
  resolved (Room Change, gate pass/QR, fee structure rules, notifications,
  the SM-03 approval gate, every gap-fill column, and the SQLite autoincrement
  quirk).
- `docs/NFR_DISPOSITION.md` -- every NFR from SRS §4.4, marked ✅/⚠️/➖ with
  code pointers.
- `docs/COMPLIANCE_REPORT.md` -- final honest audit of what was built, what
  was mocked, what was assumed, and what (if anything) was not implemented.

## What's mocked, and why

No real third-party credentials (payment gateway, SMS, email, RFID/
biometric) were available in this environment. These are implemented behind
clean interfaces (`PaymentGatewayService`, `NotificationService` in
`hms/services/`) with mock implementations that log to console and
`logs/notifications.log`. Swapping in a real integration later only
requires implementing the same interface -- no caller code changes.
