"""
JWT issuance/verification for the HTTP API.

Design choice (documented in docs/NFR_DISPOSITION.md): SRS allows either
JWT bearer tokens or secure HTTP-only cookies for session state. We use a
JWT Bearer token returned from POST /api/auth/login, stored client-side in
memory (React auth context) rather than a cookie -- this keeps the FastAPI
backend fully stateless and sidesteps CSRF concerns entirely (no cookie is
ever sent automatically by the browser, so there is nothing for a
cross-site request to ride along on). XSS remains the relevant threat model
for a Bearer token stored in JS memory; see NFR_DISPOSITION.md for the
accepted mitigations (React's default output escaping, no dangerouslySetInnerHTML
usage anywhere in the frontend).
"""
import os
from datetime import datetime, timedelta, timezone

import jwt

# In production this MUST come from a secrets manager / env var. A local
# dev default is provided so the app runs out of the box; documented as a
# deviation in docs/COMPLIANCE_REPORT.md.
JWT_SECRET = os.environ.get("HMS_JWT_SECRET", "hms-dev-jwt-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_MINUTES = int(os.environ.get("HMS_JWT_EXPIRES_MINUTES", "480"))


def create_access_token(*, userid: int, username: str, role: str, entity_id: int | None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(userid),
        "username": username,
        "role": role,
        "entity_id": entity_id,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRES_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
