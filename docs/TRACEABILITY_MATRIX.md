# Traceability Matrix

Maps every SRS functional requirement to its implementing service method,
UI screen, database table(s), and test coverage. Status is ✅ Implemented for
every row -- see `docs/SRS_AMBIGUITIES.md` for how each ambiguity was
resolved and `docs/NFR_DISPOSITION.md` for non-functional requirements.

| SRS ID | Requirement | Actor | Module (service method) | UI Screen | DB Table(s) | Test | Status |
|---|---|---|---|---|---|---|---|
| FR-SM-01 | Admin CRUD on student records | Admin | `StudentService.create_student/update_student/delete_student/list_students` | `StudentAdminWidget` | Student, Login | `tests/test_student_service.py` | ✅ |
| FR-SM-02 | Student record incl. emergency contact, blood group, medical history, guardian phone | Admin | `StudentService.create_student` (gap-fill columns) | `StudentAdminWidget`, `StudentProfileWidget` | Student | `tests/test_student_service.py` | ✅ |
| FR-SM-03 | Student self-update with Admin-approval gate on critical fields | Student, Admin | `StudentService.self_update_non_critical/request_critical_change/apply_approved_change` | `StudentProfileWidget` | Student | `tests/test_student_service.py::test_critical_change_requires_admin_approval` | ✅ |
| FR-RM-01 | Room records: block, bed capacity, type | Admin | `RoomService.create_room/list_rooms` | `HostelRoomWidget` | Room, Hostel | `tests/test_room_hostel_service.py` | ✅ |
| FR-RM-02 | Auto-allocation: gender match + first available room, atomic | Admin, Warden | `AllocationService.auto_allocate` | `AllocationWidget` | Allocation, Room, Student, Hostel | `tests/test_allocation_service.py::test_auto_allocate_matches_gender_and_increments_occupancy`, `::test_over_allocation_rolls_back_cleanly` | ✅ |
| FR-RM-03 | Manual allocation by Admin/Warden | Admin, Warden | `AllocationService.manual_allocate` | `AllocationWidget` | Allocation, Room | `tests/test_allocation_service.py::test_manual_allocate_rejects_gender_mismatch` | ✅ |
| FR-HM-01 | Hostel block capacity, warden assignment, maintenance status | Admin | `HostelService.create_hostel/assign_warden/set_maintenance_status` | `HostelRoomWidget` | Hostel, Staff | `tests/test_room_hostel_service.py::test_assign_warden` | ✅ |
| FR-HM-02 | Admin creates hostel blocks & configures room capacities | Admin | `HostelService.create_hostel`, `RoomService.create_room` | `HostelRoomWidget` | Hostel, Room | `tests/test_room_hostel_service.py::test_create_hostel_and_room` | ✅ |
| FR-FM-01 | Fee structure generation per room category | Admin | `FeeService.set_fee_structure/generate_fees_for_active_allocations` | `FeeAdminWidget` | fee_structures, Fee, Allocation, Room | `tests/test_fee_service.py::test_fee_generation_and_payment_flow` | ✅ |
| FR-FM-02 | Mocked payment gateway integration | Student, Admin, Staff | `FeeService.pay_fee` -> `MockPaymentGatewayService.charge` | `FeeStudentWidget` | Fee | `tests/test_fee_service.py` | ✅ |
| FR-FM-03 | PDF receipt generation on successful payment | Student | `hms/reports/pdf_reports.py:generate_receipt` | `FeeStudentWidget` (Download Receipt) | Fee, Student | `tests/test_report_service.py::test_receipt_generation` | ✅ |
| FR-AM-01 | Daily attendance marking by warden/staff | Warden, Staff | `AttendanceService.mark_attendance` | `AttendanceWidget` | Attendance | `tests/test_attendance_service.py::test_mark_and_re_mark_attendance` | ✅ |
| FR-AM-02 | Flag students absent N consecutive days, alert list for warden | Warden | `AttendanceService.consecutive_absentee_alerts` | `AttendanceWidget` (alert table) | Attendance, Student | `tests/test_attendance_service.py::test_consecutive_absentee_alert` | ✅ |
| FR-LM-01 | Student applies for leave | Student | `LeaveService.apply_leave` | `LeaveStudentWidget` | Leave | `tests/test_leave_gatepass_chain.py` | ✅ |
| FR-LM-02 | Leave routes to warden; approval triggers guardian notification | Warden | `LeaveService.decide_leave` -> `NotificationService.send` | `LeaveWardenWidget` | Leave, Student | `tests/test_leave_gatepass_chain.py::test_full_leave_to_exit_entry_chain` | ✅ |
| FR-LM-03 | QR-coded gate pass on approval; security scan/exit-entry log | Warden, Staff | `LeaveService.decide_leave` (gate pass gen), `LeaveService.log_exit/log_entry` | `LeaveStudentWidget` (QR download), `LeaveSecurityWidget` | Leave | `tests/test_leave_gatepass_chain.py` (full §7.3 chain) | ✅ |
| FR-CM-01 | Student registers complaint with category | Student | `ComplaintService.register_complaint` | `ComplaintStudentWidget` | Complaint | `tests/test_complaint_service.py` | ✅ |
| FR-CM-02 | Auto-assignment to staff; status tracking Open->In Progress->Resolved->Closed | Staff, Warden, Admin | `ComplaintService.register_complaint` (assignment rule), `update_status` | `ComplaintStaffWidget` | Complaint, Staff | `tests/test_complaint_service.py::test_complaint_auto_assignment_by_category`, `::test_status_progression_enforced` | ✅ |
| FR-VM-01 | Staff logs visitor entry: name, contact, host student, entry time | Staff | `VisitorService.log_entry` | `VisitorWidget` | Visitor, Student | `tests/test_visitor_service.py::test_visitor_entry_and_exit_logging` | ✅ |
| FR-VM-02 | Max visiting hours constant; overstaying visitors flagged on security dashboard | Staff | `VisitorService.security_dashboard` | `VisitorWidget` (dashboard table) | Visitor | `tests/test_visitor_service.py::test_overstaying_visitor_flagged` | ✅ |
| FR-RG-01 | Fee collection reports (monthly/semester/yearly) | Admin | `ReportService.fee_collection_report` -> `pdf_reports`/`excel_reports` | `ReportsWidget` | Fee | `tests/test_report_service.py::test_fee_collection_report_and_pdf_excel` | ✅ |
| FR-RG-02 | Occupancy reports, leave logs, complaint resolution timelines (PDF + Excel) | Admin | `ReportService.occupancy_report/leave_log_report/complaint_resolution_timeline` | `ReportsWidget` | Room, Hostel, Leave, Complaint | `tests/test_report_service.py::test_occupancy_report_and_exports` | ✅ |
| Auth & Authorization | Login screen, bcrypt-12, session state, RBAC in service layer | All | `AuthService.login`, `hms/services/rbac.py` | `LoginWindow` | Login | `tests/test_auth_service.py`, `tests/test_rbac.py` | ✅ |

## Cross-cutting integration test

`tests/test_leave_gatepass_chain.py::test_full_leave_to_exit_entry_chain`
exercises the SRS §7.3 named scenario end-to-end in one test: Leave apply ->
Warden approve (+ mocked guardian notification) -> gate pass QR generated ->
security exit log recorded -> security entry log recorded, including a
negative case for a tampered gate-pass code being rejected.

## Atomicity test

`tests/test_allocation_service.py::test_over_allocation_rolls_back_cleanly`
implements the SRS §7.2 named scenario: forces a room to full capacity, then
attempts one more allocation, asserting `CapacityExceededError` is raised
AND that `Room.occupiedbeds` and the `Allocation` table are left completely
unchanged after rollback (verified via `session.expire_all()` to bypass the
SQLAlchemy identity map's cache and force a real read from the DB).
