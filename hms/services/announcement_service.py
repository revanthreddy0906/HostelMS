"""Hostel announcements / notice board (PG overview document §20): admins and wardens post, everyone reads."""
from sqlalchemy.orm import Session

from hms.models.models import Announcement
from hms.repositories.repos import AnnouncementRepository
from hms.services.exceptions import HMSNotFoundError, HMSValidationError
from hms.services.rbac import CurrentUser, require_role


class AnnouncementService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = AnnouncementRepository(session)

    def list_recent(self) -> list[Announcement]:
        return self.repo.list_recent()

    @require_role("Admin", "Warden")
    def create(self, current_user: CurrentUser, title: str, body: str, pinned: bool = False) -> Announcement:
        if not title.strip() or not body.strip():
            raise HMSValidationError("Title and message are required")
        return self.repo.add(Announcement(title=title.strip(), body=body.strip(), pinned=pinned, createdby=current_user.userid))

    @require_role("Admin", "Warden")
    def delete(self, current_user: CurrentUser, announcementid: int) -> None:
        item = self.repo.get(announcementid)
        if item is None:
            raise HMSNotFoundError(f"Announcement {announcementid} not found")
        self.repo.delete(item)
