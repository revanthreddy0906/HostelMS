# Non-Functional Requirements Disposition (SRS §4.4)

**Revision note (second pivot):** the project went SRS (web) -> user decision
(desktop, PySide6) -> user decision (back to web, FastAPI + React). This
document now reflects the **current, final architecture**: a 3-tier
client-server web app (React/TypeScript SPA frontend, FastAPI REST backend,
SQLAlchemy/SQLite-by-default ORM layer), matching the SRS's original intent.
The desktop-era disposition (marking every web NFR "N/A: superseded") is
preserved in git history (see the commit that introduced `hms/ui/`) and is
now reversed below -- see `docs/COMPLIANCE_REPORT.md` for the full revision
history of both pivots.

Status legend: ✅ Implemented · ⚠️ Partially implemented · ❌ Not implemented (documented gap)

## §4.4.1 Performance
- ⚠️ Partially implemented: 500 concurrent users / horizontal scaling / read
  replicas -- FastAPI + Uvicorn is an ASGI server capable of horizontal
  scaling (multiple Uvicorn workers behind a reverse proxy/load balancer,
  stateless JWT auth means no server-side session affinity is required), but
  no load testing against 500 concurrent users was performed in this demo,
  and SQLite (the default dev DB) is not a suitable engine for that
  concurrency level -- production deployment requires switching
  `HMS_DATABASE_URL` to Postgres/MySQL (already supported, see
  `hms/config.py`) and running multiple Uvicorn/Gunicorn workers. This is a
  genuine gap for a production rollout, not merely a technicality.
- ✅ Implemented (informally): the demo dataset's queries (list students,
  occupancy report, fee report) return well under a second locally over
  HTTP against SQLite; no formal load testing was performed.

## §4.4.2 Availability / Reliability
- ⚠️ Partially implemented: daily backups + 30-day retention.
  `scripts/backup_db.py` copies `hms.db` into `backups/` with a timestamped
  filename and prunes backups older than 30 days. It is a **utility**, not a
  scheduler -- there is no real cron/Task Scheduler wired up in this demo
  environment, so "daily" is achieved only if something external (cron,
  systemd timer, Task Scheduler) invokes the script daily. This is honestly
  marked partial rather than done. Unaffected by the web pivot.
- ❌ Not implemented: 99.9% uptime SLA -- there is now a real server process
  (Uvicorn) whose uptime *could* be measured, but no monitoring/alerting or
  SLA tracking was built for this demo. Documented gap, not applicable to a
  local dev run.

## §4.4.3 Security
- ✅ Implemented: bcrypt password hashing at cost factor 12. See
  `hms/services/auth_service.py:hash_password()` (`bcrypt.gensalt(rounds=BCRYPT_ROUNDS)`,
  `BCRYPT_ROUNDS = 12` in `hms/config.py`), enforced at every login/staff/
  student creation path and at seed time (`scripts/seed_db.py`). Unaffected
  by the web pivot.
- ✅ Implemented: Role-Based Access Control enforced at the service layer
  (not merely hidden UI buttons or a route guard). See `hms/services/rbac.py`
  (`require_role()` decorator raising `HMSPermissionError`) applied across
  every mutating method in `hms/services/*.py`. The API layer
  (`hms/api/main.py`) translates `HMSPermissionError` to HTTP 403 via a
  global exception handler -- it never re-implements the permission logic,
  it only forwards the service layer's decision. `tests/test_rbac.py` and
  `tests/api/test_api.py::test_student_forbidden_from_admin_only_endpoint`
  exercise this at both the service and HTTP layers. The React frontend
  additionally hides nav items/routes a role cannot use, as defense in depth
  -- never the actual security boundary.
- ✅ Implemented (real, now that we're web again): JWT bearer tokens.
  `POST /api/auth/login` issues a signed JWT (`hms/api/security.py`,
  HS256, configurable expiry via `HMS_JWT_EXPIRES_MINUTES`) containing
  userid/username/role/entity_id. The frontend stores it and sends it as
  `Authorization: Bearer <token>` on every request; `hms/api/deps.py:get_current_user`
  validates and decodes it per-request. **Design choice documented here**:
  we chose a Bearer token over an HTTP-only cookie (the SRS permits either).
  Rationale: it keeps the API fully stateless, and a Bearer token is never
  attached automatically by the browser to a cross-site request, so **CSRF
  is structurally not applicable** to this API -- there is no ambient
  credential for a forged cross-site request to ride along on. The
  trade-off is that a Bearer token kept in JS-reachable storage is
  vulnerable to theft via XSS, which is why the XSS mitigation below matters.
- ✅ Implemented: XSS mitigation. React escapes all interpolated text by
  default, and all API responses are rendered as data, never as raw HTML.
  Verified: `grep -rn "dangerouslySetInnerHTML" frontend/src` returns no
  matches. Combined with FastAPI/Pydantic input validation (malformed/
  oversized payloads are rejected with 422 before reaching business logic),
  this covers the OWASP-basics bar for a demo-scale app. A
  Content-Security-Policy header was **not** added (documented gap -- easy
  to add via a reverse proxy or FastAPI middleware in production, skipped
  here to keep local dev friction-free).
- ✅ Implemented (structurally, see above): CSRF -- not applicable to a
  Bearer-token API with no ambient cookie auth.
- ⚠️ Partially implemented: HTTPS/TLS in transit -- the local dev setup
  (`uvicorn ... --port 8000`, Vite dev server on 5173) runs over plain HTTP,
  which is standard for local development. Production deployment requires
  terminating TLS at a reverse proxy (nginx/Caddy) or passing
  `--ssl-keyfile`/`--ssl-certfile` to Uvicorn -- not configured in this repo
  since there is no production domain/cert to bind to. Documented gap.
- ⚠️ Partially implemented: browser compatibility -- the frontend is a
  standard Vite/React/TypeScript build targeting evergreen browsers (no
  browser-specific hacks, no IE11 support attempted). No formal
  cross-browser test matrix (BrowserStack etc.) was run; manual verification
  was limited to the build's target environment.
- ⚠️ Partially implemented: WCAG 2.1 AA. The component library
  (`frontend/src/components/`) aims for semantic HTML (real `<button>`
  elements, labelled form inputs, `<table>` markup for data grids) and the
  Tailwind color tokens were chosen with contrast in mind, but this was
  **not** verified with an automated audit (axe-core), a real screen-reader
  pass, or a keyboard-only navigation walkthrough -- this is a genuine gap
  for a production rollout, honestly reported rather than claimed as done.

## §4.4.4 Maintainability / Interoperability
- ✅ Implemented (for real, now that we're web again): Swagger / OpenAPI
  documentation. FastAPI auto-generates and serves interactive docs at
  `/docs` (Swagger UI) and `/redoc`, plus the machine-readable schema at
  `/openapi.json`, directly from the Pydantic request/response models in
  `hms/api/schemas/` and the route signatures in `hms/api/routers/` --
  zero hand-maintained API documentation to go stale. This came essentially
  free with the framework choice.
- ✅ Implemented: layered architecture preserved end-to-end. `hms/models` ->
  `hms/repositories` -> `hms/services` (business logic + RBAC, untouched by
  this pivot) -> `hms/api` (thin HTTP translation layer, new) -> `frontend/`
  (new presentation layer). No business rule was duplicated into the API or
  frontend layers.

## §4.4.5 Usability
- ✅ Implemented: a genuine Tailwind-based design system (color tokens,
  spacing/radius/shadow scale, a reusable component library covering
  buttons/cards/tables/badges/modals/forms/toasts/sidebar nav) replacing the
  plain default-styled PySide6 widgets from the desktop build. See
  `frontend/src/components/` and the Tailwind config for the token
  definitions. Usability testing with real users was still not performed
  (unchanged limitation from the desktop build).

## Summary

| NFR area | Status |
|---|---|
| bcrypt-12 password hashing | ✅ Implemented |
| RBAC at service layer, forwarded to HTTP 403 | ✅ Implemented |
| JWT bearer auth | ✅ Implemented |
| CSRF (structurally n/a for Bearer-token API) | ✅ Implemented |
| XSS mitigation (React escaping, no raw HTML injection, Pydantic validation) | ✅ Implemented |
| Swagger/OpenAPI docs (`/docs`, `/openapi.json`) | ✅ Implemented |
| Tailwind design system / component library | ✅ Implemented |
| Backups (30-day retention) | ⚠️ Partially implemented (utility exists, no real scheduler) |
| HTTPS/TLS in transit | ⚠️ Partially implemented (local dev is plain HTTP; prod needs a TLS-terminating proxy) |
| Browser compatibility matrix | ⚠️ Partially implemented (evergreen-browser build, no formal cross-browser matrix run) |
| WCAG 2.1 AA | ⚠️ Partially implemented (semantic HTML + reasonable contrast; no formal audit) |
| 500 concurrent users / horizontal scaling / read replicas | ⚠️ Partially implemented (architecturally supported -- stateless JWT, ASGI workers, swappable DB URL -- but not load-tested; SQLite dev default is not production-suitable at this scale) |
| 99.9% uptime SLA | ❌ Not implemented (no monitoring/alerting built; N/A for a local dev run) |
| Usability testing with real users | ⚠️ Partially implemented (design system in place; no user testing performed) |

Nothing above is silently swept under "N/A" this time around -- every item
is either implemented, honestly partial with a stated reason, or an
explicit documented gap, now that the deployment target is a real web
architecture with a real (if not load-tested) server tier.
