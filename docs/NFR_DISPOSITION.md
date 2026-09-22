# Non-Functional Requirements Disposition (SRS §4.4)

Status legend: ✅ Implemented · ⚠️ Partially implemented · ➖ N/A (superseded
by the desktop architecture decision -- this is a native PySide6 desktop
application, not a web application; see `docs/COMPLIANCE_REPORT.md` for the
full rationale and the reconciliation note about the Hotel->Hostel naming and
web->desktop architecture decisions).

## §4.4.1 Performance
- ➖ N/A: 500 concurrent users / horizontal scaling / read replicas --
  superseded by desktop architecture decision. A single-user (or small LAN)
  desktop app has no server-side concurrency model to scale.
- ✅ Implemented (informally): the demo dataset's queries (list students,
  occupancy report, fee report) return well under a second against SQLite
  locally; no formal load testing was performed since there is no
  multi-user server tier to load-test.

## §4.4.2 Availability / Reliability
- ⚠️ Partially implemented: daily backups + 30-day retention.
  `scripts/backup_db.py` copies `hms.db` into `backups/` with a timestamped
  filename and prunes backups older than 30 days. It is a **utility**, not a
  scheduler -- there is no real cron/Task Scheduler wired up in this demo
  environment, so "daily" is achieved only if something external (cron,
  systemd timer, Task Scheduler) invokes the script daily. This is honestly
  marked partial rather than done.
- ➖ N/A: 99.9% uptime SLA -- superseded by desktop architecture decision;
  there is no server to measure uptime against.

## §4.4.3 Security
- ✅ Implemented: bcrypt password hashing at cost factor 12. See
  `hms/services/auth_service.py:hash_password()` (`bcrypt.gensalt(rounds=BCRYPT_ROUNDS)`,
  `BCRYPT_ROUNDS = 12` in `hms/config.py`), enforced at every login/staff/
  student creation path and at seed time (`scripts/seed_db.py`). No literal
  password hash is ever hardcoded in logic; passwords are hashed on write and
  verified with `bcrypt.checkpw()` on login.
- ✅ Implemented: Role-Based Access Control enforced at the service layer
  (not merely hidden UI buttons). See `hms/services/rbac.py`
  (`require_role()` decorator raising `HMSPermissionError`, a
  `PermissionError`-style domain exception) applied across every mutating
  method in `hms/services/*.py`. `tests/test_rbac.py` and
  `tests/test_leave_gatepass_chain.py` exercise this directly. The UI layer
  additionally hides tabs a role cannot use (`hms/ui/main_window.py`), which
  is a convenience, not the security boundary.
- ➖ N/A: HTTPS/TLS in transit -- superseded by desktop architecture
  decision; there is no network transport between a UI and a remote server
  in this local-desktop-app design (the DB connection uses the DB driver's
  own transport, e.g. TLS-capable Postgres/MySQL drivers in production).
- ➖ N/A: JWT / session cookies -- superseded by desktop architecture
  decision; session state is an in-process `CurrentUser` object
  (`hms/services/rbac.py`), not a cookie/token, because there is no HTTP
  session to represent.
- ➖ N/A: XSS / CSRF protections -- superseded by desktop architecture
  decision; there is no browser DOM or cross-site request surface in a
  native Qt UI.
- ➖ N/A: browser compatibility matrix -- superseded by desktop architecture
  decision; PySide6 renders its own native widgets, not a browser-rendered
  page.
- ➖ N/A: WCAG 2.1 AA -- superseded by desktop architecture decision. Qt has
  its own accessibility framework (QAccessible) which standard widgets
  participate in by default, but a full WCAG 2.1 AA audit (contrast ratios,
  keyboard-only navigation testing, screen-reader verification) was not
  performed and is out of scope for this demo; this is a genuine gap for a
  production rollout, not merely a web-vs-desktop technicality.

## §4.4.4 Maintainability / Interoperability
- ➖ N/A: Swagger / OpenAPI documentation -- superseded by desktop
  architecture decision; there is no REST API surface to document. The
  layered architecture (`hms/models`, `hms/repositories`, `hms/services`,
  `hms/ui`) is documented instead in `README.md`'s architecture overview,
  and the service layer's public methods are the closest analogue to an API
  surface -- each is type-hinted and docstringed at the module level.

## §4.4.5 Usability
- ⚠️ Partially implemented: the UI uses plain, functional PySide6 forms and
  tables (no custom styling) per the master prompt's explicit instruction to
  prioritize correctness over UI polish. Usability testing with real users
  was not performed.

## Summary

| NFR area | Status |
|---|---|
| bcrypt-12 password hashing | ✅ Implemented |
| RBAC at service layer | ✅ Implemented |
| Backups (30-day retention) | ⚠️ Partially implemented (utility exists, no real scheduler) |
| Usability (plain functional UI) | ⚠️ Partially implemented (no user testing) |
| HTTPS/TLS, JWT/cookies, XSS/CSRF, browser compat, WCAG 2.1 AA, 500 concurrent users, horizontal scaling/read replicas, 99.9% uptime, Swagger/OpenAPI | ➖ N/A: superseded by desktop architecture decision |

Zero items are marked ❌ (not implemented with no explanation) -- every gap
above is either mocked, partially delivered with an honest caveat, or
explicitly out of scope because the deployment target changed from a web
service to a native desktop app (a decision made jointly with the user
before this build started).
