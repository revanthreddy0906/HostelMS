"""
Admin-configurable hostel settings (PG overview document §9-§11, §17).

Values are stored as strings in the `setting` table; anything not stored yet
falls back to DEFAULTS, so a fresh database behaves per the document
(rent due on the 3rd, ₹50/day fine, ₹3,000 deposit, sharing rents, ₹8/unit AC).
"""
from sqlalchemy.orm import Session

from hms.models.models import Room, Setting
from hms.repositories.repos import SettingRepository
from hms.services.exceptions import HMSValidationError
from hms.services.rbac import CurrentUser, require_role

SHARING_CAPACITY = {"3 Sharing": 3, "4 Sharing": 4, "5 Sharing": 5, "Pentahouse": None}

DEFAULTS: dict[str, str] = {
    "rent_due_day": "3",
    "late_fine_per_day": "50",
    "security_deposit": "3000",
    "rent_3_sharing": "8000",
    "rent_4_sharing": "7000",
    "rent_5_sharing": "6500",
    "rent_pentahouse": "12000",
    "ac_rate_per_unit": "8",
}

# (min, max) accepted for each setting; all are numeric
LIMITS: dict[str, tuple[float, float]] = {
    "rent_due_day": (1, 28),
    "late_fine_per_day": (0, 10_000),
    "security_deposit": (0, 1_000_000),
    "rent_3_sharing": (0, 1_000_000),
    "rent_4_sharing": (0, 1_000_000),
    "rent_5_sharing": (0, 1_000_000),
    "rent_pentahouse": (0, 1_000_000),
    "ac_rate_per_unit": (0, 1_000),
}


def rent_key(sharing_type: str) -> str:
    return "rent_pentahouse" if sharing_type == "Pentahouse" else f"rent_{sharing_type.split()[0]}_sharing"


class SettingsService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = SettingRepository(session)

    def get_all(self) -> dict[str, str]:
        values = dict(DEFAULTS)
        for row in self.repo.list_all():
            values[row.key] = row.value
        return values

    def get_float(self, key: str) -> float:
        row = self.repo.get(key)
        return float(row.value if row else DEFAULTS[key])

    def get_int(self, key: str) -> int:
        return int(self.get_float(key))

    def rent_for(self, sharing_type: str) -> float:
        return self.get_float(rent_key(sharing_type))

    @require_role("Admin")
    def update(self, current_user: CurrentUser, values: dict[str, float]) -> dict[str, str]:
        for key, raw in values.items():
            if key not in DEFAULTS:
                raise HMSValidationError(f"Unknown setting '{key}'")
            low, high = LIMITS[key]
            value = float(raw)
            if not low <= value <= high:
                raise HMSValidationError(f"{key} must be between {low:g} and {high:g}")
            text = str(int(value)) if key == "rent_due_day" else f"{value:g}"
            row = self.repo.get(key)
            if row:
                row.value = text
            else:
                self.repo.add(Setting(key=key, value=text))
            # Sharing rents apply to every student room of that type (Pentahouse rent is per room).
            if key.startswith("rent_") and key != "rent_pentahouse":
                sharing = f"{key.split('_')[1]} Sharing"
                for room in self.session.query(Room).filter(Room.roomtype == sharing, Room.purpose == "Student"):
                    room.monthlyrent = value
        self.session.flush()
        return self.get_all()
