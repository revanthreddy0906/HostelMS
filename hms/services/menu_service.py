"""
Weekly food / mess menu (PG overview document §13-§14).

One row per weekday with breakfast, lunch and dinner; lunch and dinner can
carry a separate non-veg option. Fryums are served on exactly two days a week,
so the week is saved as a whole and validated together.
"""
from sqlalchemy.orm import Session

from hms.models.models import FoodMenu
from hms.repositories.repos import FoodMenuRepository
from hms.services.exceptions import HMSValidationError
from hms.services.rbac import CurrentUser, require_role

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
FRYUMS_PER_WEEK = 2
FIELDS = ("breakfast", "lunch", "lunchnonveg", "dinner", "dinnernonveg", "fryums")


class MenuService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = FoodMenuRepository(session)

    def get_week(self) -> list[FoodMenu]:
        rows = {m.day: m for m in self.repo.list_all()}
        return [rows[d] for d in DAYS if d in rows]

    @require_role("Admin", "Warden")
    def save_week(self, current_user: CurrentUser, days: list[dict]) -> list[FoodMenu]:
        by_day = {d.get("day"): d for d in days}
        if sorted(by_day) != sorted(DAYS):
            raise HMSValidationError("Send all seven days, Monday to Sunday")
        for day, values in by_day.items():
            for meal in ("breakfast", "lunch", "dinner"):
                if not (values.get(meal) or "").strip():
                    raise HMSValidationError(f"{day}: {meal} cannot be empty")
        fryums = sum(1 for v in by_day.values() if v.get("fryums"))
        if fryums != FRYUMS_PER_WEEK:
            raise HMSValidationError(f"Fryums must be scheduled on exactly {FRYUMS_PER_WEEK} days a week (currently {fryums})")
        rows = []
        for day in DAYS:
            values = by_day[day]
            row = self.repo.get(day) or FoodMenu(day=day, breakfast="", lunch="", dinner="")
            row.breakfast = values["breakfast"].strip()
            row.lunch = values["lunch"].strip()
            row.lunchnonveg = (values.get("lunchnonveg") or "").strip() or None
            row.dinner = values["dinner"].strip()
            row.dinnernonveg = (values.get("dinnernonveg") or "").strip() or None
            row.fryums = bool(values.get("fryums"))
            self.session.add(row)
            rows.append(row)
        self.session.flush()
        return rows
