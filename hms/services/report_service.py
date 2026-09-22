"""
Reporting service -- pure data aggregation used by hms/reports/*.

FR-RG-01: fee collection reports (monthly/semester/yearly).
FR-RG-02: occupancy reports, leave logs, complaint resolution timelines.
"""
from datetime import date

from sqlalchemy.orm import Session

from hms.repositories.repos import FeeRepository, LeaveRepository, ComplaintRepository
from hms.services.room_service import RoomService


class ReportService:
    def __init__(self, session: Session):
        self.session = session
        self.fee_repo = FeeRepository(session)
        self.leave_repo = LeaveRepository(session)
        self.complaint_repo = ComplaintRepository(session)
        self.room_service = RoomService(session)

    def fee_collection_report(self, start: date, end: date) -> dict:
        fees = self.fee_repo.list_between(start, end)
        total_due = sum(float(f.amountdue) for f in fees)
        total_collected = sum(float(f.amountpaid) for f in fees)
        rows = [
            {
                "feeid": f.feeid,
                "studentid": f.studentid,
                "amountdue": float(f.amountdue),
                "amountpaid": float(f.amountpaid),
                "status": f.paymentstatus,
                "duedate": f.duedate,
            }
            for f in fees
        ]
        return {
            "period": (start, end),
            "total_due": total_due,
            "total_collected": total_collected,
            "outstanding": total_due - total_collected,
            "rows": rows,
        }

    def occupancy_report(self) -> list[dict]:
        return self.room_service.occupancy_report_rows()

    def leave_log_report(self) -> list[dict]:
        leaves = self.leave_repo.list_all()
        return [
            {
                "leaveid": l.leaveid,
                "studentid": l.studentid,
                "startdate": l.startdate,
                "enddate": l.enddate,
                "status": l.status,
                "exitlogged": l.exitlogged,
                "entrylogged": l.entrylogged,
            }
            for l in leaves
        ]

    def complaint_resolution_timeline(self) -> list[dict]:
        complaints = self.complaint_repo.list_all_ordered()
        return [
            {
                "complaintid": c.complaintid,
                "studentid": c.studentid,
                "category": c.category,
                "status": c.status,
                "createdat": c.createdat,
                "assignedstaffid": c.assignedstaffid,
            }
            for c in complaints
        ]
