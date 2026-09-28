"""Admin dashboard aggregates (PG overview document §19): counts and chart series in one call."""
from collections import Counter
from datetime import date, datetime

from sqlalchemy.orm import Session

from hms.models.models import Allocation, Complaint, Fee, MaintenanceRequest, ParentGuest, Payment, Room, Student
from hms.services.fee_service import FeeService
from hms.services.rbac import CurrentUser, require_role


def _month_key(d: date | datetime) -> str:
    return f"{d.year}-{d.month:02d}"


class DashboardService:
    def __init__(self, session: Session):
        self.session = session
        self.fees = FeeService(session)

    @require_role("Admin")
    def admin_summary(self, current_user: CurrentUser) -> dict:
        s = self.session
        today = date.today()
        rooms = s.query(Room).all()
        student_rooms = [r for r in rooms if r.purpose == "Student"]
        parent_rooms = [r for r in rooms if r.purpose == "Parent"]
        active = s.query(Allocation).filter(Allocation.status == "Active").all()
        active_ids = {a.studentid for a in active}
        ever_housed = {a.studentid for a in s.query(Allocation.studentid).distinct()}
        vacated = ever_housed - active_ids

        unpaid = s.query(Fee).filter(Fee.paymentstatus != "Paid").all()
        pending_fees = sum(self.fees.balance_for(f, today) for f in unpaid if f.billtype != "Deposit")
        ac_pending = sum(1 for f in unpaid if f.billtype == "AC")

        # Revenue for the last six months (settlement transfers from deposits aren't new revenue).
        months: list[str] = []
        y, m = today.year, today.month
        for _ in range(6):
            months.insert(0, f"{y}-{m:02d}")
            y, m = (y - 1, 12) if m == 1 else (y, m - 1)
        revenue = Counter()
        for p in s.query(Payment).filter(Payment.method != "Settlement").all():
            revenue[_month_key(p.paidat)] += float(p.amount)

        floor_occupancy: dict[tuple[str, int], list[int]] = {}
        for r in student_rooms:
            entry = floor_occupancy.setdefault((r.hostel.hostelname, r.floor), [0, 0])
            entry[0] += r.occupiedbeds
            entry[1] += r.capacity

        room_by_id = {r.roomid: r for r in rooms}
        sharing = Counter(room_by_id[a.roomid].roomtype for a in active if a.roomid in room_by_id)
        maintenance = s.query(MaintenanceRequest).all()
        complaints = s.query(Complaint).all()
        staying = s.query(ParentGuest).filter(ParentGuest.status == "Staying").all()

        return {
            "counts": {
                "active_students": len(active_ids),
                "vacated_students": len(vacated),
                "awaiting_room": s.query(Student).count() - len(active_ids) - len(vacated),
                "total_rooms": len(student_rooms),
                "occupied_rooms": sum(1 for r in student_rooms if r.occupiedbeds > 0),
                "available_beds": sum(r.capacity - r.occupiedbeds for r in student_rooms),
                "total_beds": sum(r.capacity for r in student_rooms),
                "revenue_this_month": revenue.get(_month_key(today), 0.0),
                "pending_fees": round(pending_fees, 2),
                "open_maintenance": sum(1 for x in maintenance if x.status not in ("Resolved", "Rejected")),
                "open_complaints": sum(1 for c in complaints if c.status != "Resolved"),
                "ac_bills_pending": ac_pending,
                "parent_rooms_occupied": len({g.roomid for g in staying}),
                "parent_rooms": len(parent_rooms),
            },
            "occupancy_by_floor": [
                {"label": f"{hostel.split()[0]} F{floor}", "occupied": occ, "free": cap - occ}
                for (hostel, floor), (occ, cap) in sorted(floor_occupancy.items())
            ],
            "students_by_sharing": [{"label": k, "value": v} for k, v in sorted(sharing.items())],
            "revenue_by_month": [{"month": mth, "amount": round(revenue.get(mth, 0.0), 2)} for mth in months],
            "maintenance_by_status": [{"label": k, "value": v} for k, v in Counter(x.status for x in maintenance).items()],
            "complaints_by_category": [{"label": k, "value": v} for k, v in Counter(c.category for c in complaints).most_common()],
        }
