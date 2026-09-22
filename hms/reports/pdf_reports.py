"""PDF report/receipt builders using reportlab (FR-FM-03, FR-RG-01/02)."""
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet


def generate_receipt(filepath: str, *, fee, student) -> str:
    """Generates a payment receipt PDF for a successfully-paid Fee row."""
    doc = SimpleDocTemplate(filepath, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = [
        Paragraph("Hostel Management System - Fee Payment Receipt", styles["Title"]),
        Spacer(1, 12),
        Paragraph(f"Receipt for: {student.firstname} {student.lastname} ({student.rollnumber})", styles["Normal"]),
        Spacer(1, 12),
    ]
    data = [
        ["Fee ID", str(fee.feeid)],
        ["Amount Due", f"{float(fee.amountdue):.2f}"],
        ["Amount Paid", f"{float(fee.amountpaid):.2f}"],
        ["Payment Status", fee.paymentstatus],
        ["Transaction Reference", fee.txnreference or "-"],
        ["Due Date", str(fee.duedate)],
    ]
    table = Table(data, colWidths=[60 * mm, 90 * mm])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
            ]
        )
    )
    elements.append(table)
    doc.build(elements)
    return filepath


def _rows_table(headers, rows):
    data = [headers] + rows
    table = Table(data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def generate_fee_collection_report(filepath: str, report: dict) -> str:
    doc = SimpleDocTemplate(filepath, pagesize=A4)
    styles = getSampleStyleSheet()
    start, end = report["period"]
    elements = [
        Paragraph("Fee Collection Report", styles["Title"]),
        Paragraph(f"Period: {start} to {end}", styles["Normal"]),
        Paragraph(f"Total Due: {report['total_due']:.2f}", styles["Normal"]),
        Paragraph(f"Total Collected: {report['total_collected']:.2f}", styles["Normal"]),
        Paragraph(f"Outstanding: {report['outstanding']:.2f}", styles["Normal"]),
        Spacer(1, 12),
    ]
    headers = ["Fee ID", "Student ID", "Due", "Paid", "Status", "Due Date"]
    rows = [
        [r["feeid"], r["studentid"], f"{r['amountdue']:.2f}", f"{r['amountpaid']:.2f}", r["status"], str(r["duedate"])]
        for r in report["rows"]
    ]
    elements.append(_rows_table(headers, rows))
    doc.build(elements)
    return filepath


def generate_occupancy_report(filepath: str, rows: list[dict]) -> str:
    doc = SimpleDocTemplate(filepath, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = [Paragraph("Occupancy Report", styles["Title"]), Spacer(1, 12)]
    headers = ["Hostel", "Room", "Type", "Capacity", "Occupied", "Free"]
    table_rows = [[r["hostel"], r["room"], r["type"], r["capacity"], r["occupied"], r["free"]] for r in rows]
    elements.append(_rows_table(headers, table_rows))
    doc.build(elements)
    return filepath


def generate_leave_log_report(filepath: str, rows: list[dict]) -> str:
    doc = SimpleDocTemplate(filepath, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = [Paragraph("Leave Log Report", styles["Title"]), Spacer(1, 12)]
    headers = ["Leave ID", "Student ID", "Start", "End", "Status", "Exit Logged", "Entry Logged"]
    table_rows = [
        [r["leaveid"], r["studentid"], str(r["startdate"]), str(r["enddate"]), r["status"],
         str(r["exitlogged"] or "-"), str(r["entrylogged"] or "-")]
        for r in rows
    ]
    elements.append(_rows_table(headers, table_rows))
    doc.build(elements)
    return filepath


def generate_complaint_timeline_report(filepath: str, rows: list[dict]) -> str:
    doc = SimpleDocTemplate(filepath, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = [Paragraph("Complaint Resolution Timeline", styles["Title"]), Spacer(1, 12)]
    headers = ["Complaint ID", "Student ID", "Category", "Status", "Created At", "Assigned Staff"]
    table_rows = [
        [r["complaintid"], r["studentid"], r["category"], r["status"], str(r["createdat"]), r["assignedstaffid"] or "-"]
        for r in rows
    ]
    elements.append(_rows_table(headers, table_rows))
    doc.build(elements)
    return filepath
