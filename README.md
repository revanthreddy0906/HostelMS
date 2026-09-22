# Hostel Management System (HMS)

A 3-tier client-server web application implementing the attached SRS: a
FastAPI REST backend, a React + TypeScript + Tailwind CSS single-page
frontend, and a SQLAlchemy ORM layer (SQLite by default, swappable to
Postgres/MySQL).

> **Naming note:** the original request said "Hotel Management System," but
> the SRS is unambiguously a **Hostel** Management System (students, wardens,
> out-passes, guardians, hostel blocks, roll numbers). Per the SRS-as-source-
> of-truth instruction, this project uses Hostel/Student/Warden vocabulary
> throughout. See `docs/SRS_AMBIGUITIES.md` §1 and `docs/COMPLIANCE_REPORT.md`.

> **Architecture note (second pivot):** this project went SRS (web) ->
> desktop (PySide6) -> web (current, FastAPI + React) over the course of its
> development. See `docs/COMPLIANCE_REPORT.md`'s revision history for the
> full story. The business logic in `hms/services/` never changed across
> either pivot -- only the presentation/transport layer on top of it did.

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
  api/           FastAPI HTTP layer: JWT auth, one router per module,
                  Pydantic schemas, global exception handlers -- a thin
                  translation layer over hms/services, no business logic
scripts/
  seed_db.py     Creates schema + seeds demo data (admin, hostels, rooms,
                  staff, students, fees, complaint, leave)
  backup_db.py   Timestamped SQLite backup utility with 30-day pruning
tests/           pytest suite against the service/repository layer -- 36
                  tests covering every FR + the SRS §7.2 and §7.3 named
                  scenarios
tests/api/       pytest + FastAPI TestClient suite exercising the same
                  critical paths (login/JWT, RBAC->403, allocation capacity,
                  leave->gatepass->exit/entry chain) over real HTTP
frontend/        React + TypeScript + Tailwind CSS SPA -- one page per
                  module, a small reusable component/design-system library,
                  calls the FastAPI backend for all data
docs/            Traceability matrix, SRS ambiguities, NFR disposition,
                  final compliance report (incl. the two-pivot history)
```

Layered dependency direction: `frontend -> api -> services -> repositories
-> models`. Neither the API layer nor the frontend talks to the database
directly; every request goes through the service layer, which enforces RBAC
and business rules and is the layer covered by `tests/`. The API layer adds
its own integration tests (`tests/api/`) that exercise the same rules over
HTTP, plus JWT issuance/validation which only exists at that layer.

## Requirements

- Python 3.10+ (developed and tested on 3.13) -- see `requirements.txt`:
  FastAPI, Uvicorn, SQLAlchemy, bcrypt, PyJWT, reportlab, openpyxl,
  qrcode[pil], pytest, pytest-cov, httpx.
- Node.js 18+ and npm, for the `frontend/` React app.

## Setup

```bash
cd HostelMS
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

Run the backend and frontend in two terminals (seed the database first, as
above, if you haven't already).

**Backend** (FastAPI, serves the REST API + interactive docs):

```bash
source .venv/bin/activate
uvicorn hms.api.main:app --reload --port 8000
```

- API base URL: `http://localhost:8000/api/...`
- Interactive Swagger docs: `http://localhost:8000/docs`
- OpenAPI schema: `http://localhost:8000/openapi.json`

**Frontend** (Vite dev server, proxies `/api/*` to the backend):

```bash
cd frontend
npm install
npm run dev
```

- App URL: `http://localhost:5173`
- Log in with any of the seeded credentials above; the UI shows only the
  modules that role can access and redirects to `/login` if unauthenticated.

For a production-style check that the frontend actually compiles cleanly:

```bash
cd frontend
npm run build
```

## Run the tests

```bash
./.venv/bin/python -m pytest -q
# or with coverage:
./.venv/bin/python -m pytest --cov=hms --cov-report=term-missing
```

41 tests, all passing: the original 36 service/repository tests (bcrypt
hashing, login/RBAC, student CRUD + self-update approval gate, hostel/room
creation, allocation atomicity incl. the SRS §7.2 rollback scenario and
room-change transfer, fee structure/generation/payment/receipt, attendance
marking + consecutive-absentee alerts, the full SRS §7.3 leave -> gate-pass
-> exit/entry chain incl. a tampered-code rejection case, complaint
auto-assignment + status progression, visitor entry/exit + overstay
flagging, and report generation for fee collection/occupancy/leave logs/
complaint timelines) plus 5 new `tests/api/` tests exercising login/JWT,
RBAC -> HTTP 403, allocation capacity enforcement, and the full leave ->
gate-pass -> exit -> entry chain over real HTTP via FastAPI's TestClient.
Every service/repository module is deliberately kept free of any HTTP/UI
framework import, so `pytest` runs fully headless regardless of which
presentation layer sits on top.

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

## Authentication

`POST /api/auth/login` issues a signed JWT (HS256, `hms/api/security.py`)
containing the user's id/username/role/entity_id. The frontend sends it back
as `Authorization: Bearer <token>` on every subsequent request. See
`docs/NFR_DISPOSITION.md` §4.4.3 for the documented rationale for choosing a
Bearer token over an HTTP-only cookie (both are SRS-permitted).

## Documentation

- `docs/TRACEABILITY_MATRIX.md` -- all 20 FRs + auth mapped to service
  method, API endpoint, React UI page, DB table, and test.
- `docs/SRS_AMBIGUITIES.md` -- every ambiguity in the SRS and how it was
  resolved (Room Change, gate pass/QR, fee structure rules, notifications,
  the SM-03 approval gate, every gap-fill column, and the SQLite autoincrement
  quirk).
- `docs/NFR_DISPOSITION.md` -- every NFR from SRS §4.4, marked ✅/⚠️/❌ with
  code pointers, reflecting the current web architecture.
- `docs/COMPLIANCE_REPORT.md` -- final honest audit of what was built, what
  was mocked, what was assumed, what (if anything) was not implemented, and
  the full two-pivot revision history.

## What's mocked, and why

No real third-party credentials (payment gateway, SMS, email, RFID/
biometric) were available in this environment. These are implemented behind
clean interfaces (`PaymentGatewayService`, `NotificationService` in
`hms/services/`) with mock implementations that log to console and
`logs/notifications.log`. Swapping in a real integration later only
requires implementing the same interface -- no caller code changes, in
either the service layer or the API layer built on top of it.
