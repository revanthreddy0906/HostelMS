# SRS Ambiguities & Resolutions

This document records every place where the SRS was ambiguous, incomplete, or
internally inconsistent, and states exactly how this implementation resolved
it. Nothing below is a silent deviation -- each item is also reflected in
`docs/TRACEABILITY_MATRIX.md` and, where relevant, in code comments at the
point of resolution.

## 1. Naming: "Hotel" vs "Hostel"

The user's original prompt said "Hotel Management System", but the attached
SRS is unambiguously a **Hostel** Management System (students, wardens,
out-passes/gate-passes, guardians, hostel blocks, roll numbers -- none of
which are hotel/guest/reservation concepts). Per the master prompt's own
instruction that the SRS is the source of truth, this project uses
Hostel/Student/Warden/Hostel/Allocation vocabulary everywhere in code,
tables, and UI labels. "Hotel" only appears in this note and in
`docs/COMPLIANCE_REPORT.md`'s explanation of the discrepancy.

## 2. Role model: 4-role schema vs 5 user classes in SRS §2.3

`Login.role` is exactly `Student | Warden | Staff | Admin` per the schema.
SRS §2.3 names 5 user classes: Admin, Warden, Student, Accountant, Hostel
Staff. Resolution: "Accountant" duties (fee structure configuration, fee
report generation, marking overdue fees) are performed by the **Admin**
role; "Hostel Staff" duties (complaint handling, visitor logging, gate-pass
exit/entry scanning, attendance marking) are performed by the **Staff**
role. This is enforced in `hms/services/rbac.py` and reflected in every
`@require_role(...)` decorator across the service layer.

## 3. Room Change (product function, no dedicated table)

The SRS lists "Room Change" as a product function but defines no table for
it. Resolution: implemented in `AllocationService.change_room()`
(`hms/services/allocation_service.py`) as a single atomic transaction that:
1. Sets the student's current `Allocation.status = 'Transferred'` and
   `vacatedate`, decrementing the old room's `occupiedbeds`.
2. Creates a new `Allocation` row with `status = 'Active'` for the new room,
   incrementing its `occupiedbeds`.

No 13th/14th table was added for this.

## 4. Gate pass / QR code (FR-LM-03, no table)

No table is defined for gate passes. Resolution: the gate pass is derived
entirely from the approved `Leave` row. Two nullable columns were added to
`Leave` as necessary supporting columns: `gatepasscode`, `exitlogged`,
`entrylogged`. The pass code itself is `f"{leaveid}:{checksum}"` where
`checksum` is an HMAC-SHA256 (truncated to 16 hex chars) over
`leaveid:studentid` with a server-side secret
(`hms/services/leave_service.py:_GATE_PASS_SECRET`), so a tampered code is
rejected at scan time (`verify_gatepass_code`). The QR image itself is
generated on demand via the `qrcode` library and never persisted to a table.

## 5. Fee structure rules (FR-FM-01)

The SRS requires "fee structure generation per room category" but defines no
supporting table. Resolution: added one small supporting table,
`fee_structures` (id, roomtype, amount, effective_semester), which is the
14th table technically but was judged a "supporting functionality necessary"
case per the master prompt's own allowance -- it is the minimal durable
representation of a business rule that varies over time (Admin can update
per-semester pricing) and could not reasonably be a hardcoded dict without
losing that configurability. `FeeService.generate_fees_for_active_allocations()`
reads this table to price a `Fee` row per active `Allocation`, keyed on the
allocated room's `roomtype`.

## 6. Notifications (no table)

No notification table exists in the SRS. Resolution: `NotificationService`
is an abstract interface (`hms/services/notification_service.py`) with a
`FileNotificationService` mock implementation that logs to console and
appends to `logs/notifications.log`. No third-party SMS/Email credentials
were available in this environment, so this is a documented mock, not a
missing table.

## 7. Student self-update / Admin-approval gate (FR-SM-03)

FR-SM-03 requires that some student self-updates go through Admin approval,
but adding a 14th "PendingChangeRequest" table was judged out of scope given
the explicit instruction to keep to the 12 tables (+ the one necessary
`fee_structures` addition). Resolution: `StudentService` distinguishes:
- **Self-editable fields** (contact phone, guardian phone, emergency
  contact, blood group, medical history) -- committed immediately via
  `self_update_non_critical()`.
- **Critical fields** (roll number, first/last name, gender, DOB) --
  `request_critical_change()` validates and returns a change-request payload
  but does **not** write to the DB. The UI is responsible for routing this
  payload to an Admin, who calls `apply_approved_change()` to commit it.

The "pending" state therefore lives in the UI/caller layer for this demo
rather than in a new database table -- a deliberate scope-minimizing design,
not an oversight. A production system would likely add a dedicated
`change_requests` table; this is called out as a known limitation in
`docs/COMPLIANCE_REPORT.md`.

## 8. FR-SM-02 gap-fill columns (emergency contact, blood group, medical history)

The `Student` schema table in the SRS omits emergency contact, blood group,
and medical history, but FR-SM-02's prose requires storing them. Resolution:
added `emergencycontact`, `bloodgroup`, `medicalhistory` as nullable columns
on `Student`.

## 9. FR-CM-02 gap-fill column (assignedstaffid)

Auto-assignment of a complaint to a staff member requires somewhere to store
the assignment. Resolution: added nullable `assignedstaffid` (FK -> Staff)
to `Complaint`.

**Auto-assignment rule** (also not specified by the SRS, resolved here):
category is mapped to a target designation
(`Plumbing/Electrical -> Maintenance`, `Cleaning -> Cleaner`,
`Internet -> Technician`, `Others -> Security`); among Staff with that
designation, the complaint is assigned to whichever staff member currently
has the fewest Open/In-Progress complaints (least-loaded). If no staff with
the target designation exists, the pool falls back to all Staff members.

## 10. FR-VM-01 gap-fill column (contactnumber)

FR-VM-01 requires storing the visitor's contact number; the `Visitor` schema
table omits it. Resolution: added nullable `contactnumber` to `Visitor`.

## 11. FR-HM-01 gap-fill columns (maintenancestatus, wardenstaffid)

FR-HM-01 requires tracking a hostel block's maintenance status and warden
assignment; the `Hostel` schema table has neither. Resolution: added
nullable `maintenancestatus` (default `'OPERATIONAL'`) and nullable
`wardenstaffid` (FK -> Staff) to `Hostel`.

## 12. `Leave` as a table name

`Leave` is a reserved word in MySQL (and a soft keyword in some SQL
dialects). SQLite raises no error for it, so the demo runs unmodified, but a
Postgres/MySQL deployment should either quote the identifier consistently
(SQLAlchemy already quotes it via the dialect) or rename the table. No
rename was done here to keep the table name matching the SRS's own
`Leave` naming; this is flagged so a future migration to MySQL is aware of
the reserved-word interaction.

## 13. SQLite BIGINT primary key autoincrement quirk

`Login.userid` is specified as `BIGINT PK AUTOINC`. SQLite only treats a
bare `INTEGER PRIMARY KEY` column as an alias for its autoincrementing
rowid; a `BIGINT PRIMARY KEY` column (the literal SQLAlchemy `BigInteger`
type) silently fails to autoincrement on SQLite while working correctly on
Postgres/MySQL. Resolution: `userid` uses
`BigInteger().with_variant(Integer, "sqlite")`, i.e. BIGINT everywhere except
SQLite, where it becomes INTEGER (still 64-bit-safe within SQLite's dynamic
typing, and functionally identical to BIGINT for a rowid alias).

## 14. Database engine

The SRS specifies Postgres 15+/MySQL 8.0+. This implementation defaults to
SQLite via `HMS_DATABASE_URL` (see `hms/config.py`) for a zero-setup local
demo, while remaining swappable to Postgres/MySQL by changing that one
environment variable -- SQLAlchemy's ORM layer and all queries are
dialect-agnostic. This is a documented deviation, not a silent one; see
`docs/COMPLIANCE_REPORT.md`.
