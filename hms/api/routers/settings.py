from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from hms.api.deps import get_current_user, get_db
from hms.api.schemas.fee import SettingsOut, SettingsUpdate
from hms.services.rbac import CurrentUser
from hms.services.settings_service import SettingsService

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return {"values": SettingsService(db).get_all()}


@router.put("", response_model=SettingsOut)
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return {"values": SettingsService(db).update(current_user, payload.values)}
