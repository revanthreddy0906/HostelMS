from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from hms.api.deps import get_current_user, get_db
from hms.api.schemas.auth import ChangePasswordRequest, CurrentUserResponse, LoginRequest, LoginResponse
from hms.api.security import create_access_token
from hms.services.auth_service import AuthService
from hms.services.rbac import CurrentUser

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    auth = AuthService(db)
    user = auth.login(payload.username, payload.password)
    token = create_access_token(
        userid=user.userid, username=user.username, role=user.role, entity_id=user.entity_id
    )
    return LoginResponse(
        access_token=token,
        userid=user.userid,
        username=user.username,
        role=user.role,
        entity_id=user.entity_id,
    )


@router.get("/me", response_model=CurrentUserResponse)
def me(current_user: CurrentUser = Depends(get_current_user)):
    return CurrentUserResponse(
        userid=current_user.userid,
        username=current_user.username,
        role=current_user.role,
        entity_id=current_user.entity_id,
    )


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    AuthService(db).change_password(current_user.userid, payload.new_password)
    return {"detail": "Password changed"}
