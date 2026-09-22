"""Shared FastAPI dependencies: DB session, current-user resolution, role gating."""
from typing import Generator

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from hms.db import SessionLocal
from hms.api.security import decode_access_token
from hms.services.rbac import CurrentUser

_bearer_scheme = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return CurrentUser(
        userid=int(payload["sub"]),
        username=payload["username"],
        role=payload["role"],
        entity_id=payload.get("entity_id"),
    )


def require_role(*allowed_roles: str):
    """FastAPI dependency factory mirroring hms.services.rbac.require_role, for
    defense-in-depth at the API boundary. The service layer still enforces the
    real RBAC rule; this only produces a friendlier 403 before we even touch
    the service for endpoints where the whole endpoint is role-restricted."""

    def _dep(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not permitted to access this resource",
            )
        return current_user

    return _dep
