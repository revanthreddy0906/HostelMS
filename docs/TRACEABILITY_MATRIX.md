# Traceability Matrix

Maps every SRS functional requirement to its implementing service method,
API endpoint, UI page/component, database table(s), and test coverage.
Status is ✅ Implemented for every row -- see `docs/SRS_AMBIGUITIES.md` for
how each ambiguity was resolved and `docs/NFR_DISPOSITION.md` for
non-functional requirements.

**Note on the UI column**: this matrix originally mapped each FR to a Qt
widget name (`hms/ui/widgets/*`) from the desktop-architecture build. That
UI was deleted in the second (desktop -> web) pivot; the column below now
maps to the React page/component in `frontend/src/pages/` that replaced it.
The Module/DB/Test columns are unaffected -- the service and repository
layers did not change across this pivot.

| SRS ID | Requirement | Actor | Module (service method) | API Endpoint | UI Page (React) | DB Table(s) | Test | Status |
|---|---|---|---|---|---|---|---|---|
| FR-SM-01 | Admin CRUD on student records | Admin | `StudentService.create_student/update_student/delete_student/list_students` | `POST/PUT/DELETE/GET /api/students` | `StudentsPage` (Admin CRUD table + modal) | Student, Login | `tests/test_student_service.py` | ✅ |
| FR-SM-02 | Student record incl. emergency contact, blood group, medical history, guardian phone | Admin | `StudentService.create_student` (gap-fill columns) | `POST /api/students`, `GET /api/students/{id}` | `StudentsPage` (profile detail view) | Student | `tests/test_student_service.py` | ✅ |
| FR-SM-03 | Student self-update with Admin-approval gate on critical fields | Student, Admin | `StudentService.self_update_non_critical/request_critical_change/apply_approved_change` | `PUT /api/students/me/profile`, `POST /api/students/me/request-change`, `POST /api/students/{id}/approve-change` | `StudentsPage` (self-profile edit + change-request), `StudentsPage` (Admin approval action) | Student | `tests/test_student_service.py::test_critical_change_requires_admin_approval` | ✅ |
| FR-RM-01 | Room records: block, bed capacity, type | Admin | `RoomService.create_room/list_rooms` | `POST/GET /api/rooms` | `HostelsPage` (rooms tab) | Room, Hostel | `tests/test_room_hostel_service.py` | ✅ |
| FR-RM-02 | Auto-allocation: gender match + first available room, atomic | Admin, Warden | `AllocationService.auto_allocate` | `POST /api/allocations/auto` | `AllocationsPage` (auto-allocate action) | Allocation, Room, Student, Hostel | `tests/test_allocation_service.py::test_auto_allocate_matches_gender_and_increments_occupancy`, `::test_over_allocation_rolls_back_cleanly` | ✅ |
| FR-RM-03 | Manual allocation by Admin/Warden | Admin, Warden | `AllocationService.manual_allocate` | `POST /api/allocations/manual` | `AllocationsPage` (manual allocate form) | Allocation, Room | `tests/test_allocation_service.py::test_manual_allocate_rejects_gender_mismatch` | ✅ |
| FR-HM-01 | Hostel block capacity, warden assignment, maintenance status | Admin | `HostelService.create_hostel/assign_warden/set_maintenance_status` | `POST /api/hostels`, `POST /api/hostels/{id}/assign-warden`, `POST /api/hostels/{id}/maintenance-status` | `HostelsPage` | Hostel, Staff | `tests/test_room_hostel_service.py::test_assign_warden` | ✅ |
| FR-HM-02 | Admin creates hostel blocks & configures room capacities | Admin | `HostelService.create_hostel`, `RoomService.create_room` | `POST /api/hostels`, `POST /api/rooms` | `HostelsPage` | Hostel, Room | `tests/test_room_hostel_service.py::test_create_hostel_and_room` | ✅ |
| FR-FM-01 | Fee structure generation per room category | Admin | `FeeService.set_fee_structure/generate_fees_for_active_allocations` | `POST /api/fees/structure`, `POST /api/fees/generate` | `FeesPage` (Admin: structure/generate) | fee_structures, Fee, Allocation, Room | `tests/test_fee_service.py::test_fee_generation_and_payment_flow` | ✅ |
| FR-FM-02 | Mocked payment gateway integration | Student, Admin, Staff | `FeeService.pay_fee` -> `MockPaymentGatewayService.charge` | `POST /api/fees/{id}/pay` | `FeesPage` (Student: pay) | Fee | `tests/test_fee_service.py` | ✅ |
| FR-FM-03 | PDF receipt generation on successful payment | Student | `hms/reports/pdf_reports.py:generate_receipt` | `GET /api/reports/receipt/{feeid}.pdf` | `FeesPage` (Download Receipt button) | Fee, Student | `tests/test_report_service.py::test_receipt_generation` | ✅ |
| FR-AM-01 | Daily attendance marking by warden/staff | Warden, Staff | `AttendanceService.mark_attendance` | `POST /api/attendance` | `AttendancePage` | Attendance | `tests/test_attendance_service.py::test_mark_and_re_mark_attendance` | ✅ |
| FR-AM-02 | Flag students absent N consecutive days, alert list for warden | Warden | `AttendanceService.consecutive_absentee_alerts` | `GET /api/attendance/alerts` | `AttendancePage` (alert table) | Attendance, Student | `tests/test_attendance_service.py::test_consecutive_absentee_alert` | ✅ |
| FR-LM-01 | Student applies for leave | Student | `LeaveService.apply_leave` | `POST /api/leaves` | `LeavesPage` (Student: apply) | Leave | `tests/test_leave_gatepass_chain.py` | ✅ |
| FR-LM-02 | Leave routes to warden; approval triggers guardian notification | Warden | `LeaveService.decide_leave` -> `NotificationService.send` | `POST /api/leaves/{id}/decide` | `LeavesPage` (Warden: approve/reject) | Leave, Student | `tests/test_leave_gatepass_chain.py::test_full_leave_to_exit_entry_chain` | ✅ |
| FR-LM-03 | QR-coded gate pass on approval; security scan/exit-entry log | Warden, Staff | `LeaveService.decide_leave` (gate pass gen), `LeaveService.log_exit/log_entry` | `GET /api/leaves/{id}/gatepass-qr`, `POST /api/leaves/security/exit`, `POST /api/leaves/security/entry` | `LeavesPage` (QR display/download), `LeavesPage` (security scan panel) | Leave | `tests/test_leave_gatepass_chain.py` (full §7.3 chain), `tests/api/test_api.py::test_leave_approve_gatepass_exit_entry_chain` | ✅ |
| FR-CM-01 | Student registers complaint with category | Student | `ComplaintService.register_complaint` | `POST /api/complaints` | `ComplaintsPage` (Student: register) | Complaint | `tests/test_complaint_service.py` | ✅ |
| FR-CM-02 | Auto-assignment to staff; status tracking Open->In Progress->Resolved->Closed | Staff, Warden, Admin | `ComplaintService.register_complaint` (assignment rule), `update_status` | `POST /api/complaints`, `POST /api/complaints/{id}/status` | `ComplaintsPage` (Staff/Warden/Admin: status transitions) | Complaint, Staff | `tests/test_complaint_service.py::test_complaint_auto_assignment_by_category`, `::test_status_progression_enforced` | ✅ |
| FR-VM-01 | Staff logs visitor entry: name, contact, host student, entry time | Staff | `VisitorService.log_entry` | `POST /api/visitors` | `VisitorsPage` (log entry form) | Visitor, Student | `tests/test_visitor_service.py::test_visitor_entry_and_exit_logging` | ✅ |
| FR-VM-02 | Max visiting hours constant; overstaying visitors flagged on security dashboard | Staff | `VisitorService.security_dashboard` | `GET /api/visitors/dashboard` | `VisitorsPage` (dashboard table, overstay highlight) | Visitor | `tests/test_visitor_service.py::test_overstaying_visitor_flagged` | ✅ |
| FR-RG-01 | Fee collection reports (monthly/semester/yearly) | Admin | `ReportService.fee_collection_report` -> `pdf_reports`/`excel_reports` | `GET /api/reports/fee-collection.pdf`, `GET /api/reports/fee-collection.xlsx` | `ReportsPage` | Fee | `tests/test_report_service.py::test_fee_collection_report_and_pdf_excel` | ✅ |
| FR-RG-02 | Occupancy reports, leave logs, complaint resolution timelines (PDF + Excel) | Admin | `ReportService.occupancy_report/leave_log_report/complaint_resolution_timeline` | `GET /api/reports/occupancy.{pdf,xlsx}`, `.../leave-log.{pdf,xlsx}`, `.../complaint-timeline.{pdf,xlsx}` | `ReportsPage` | Room, Hostel, Leave, Complaint | `tests/test_report_service.py::test_occupancy_report_and_exports` | ✅ |
| Auth & Authorization | Login, bcrypt-12, JWT session state, RBAC in service layer forwarded to HTTP 403 | All | `AuthService.login`, `hms/services/rbac.py`, `hms/api/security.py` | `POST /api/auth/login`, `GET /api/auth/me` | `LoginPage` | Login | `tests/test_auth_service.py`, `tests/test_rbac.py`, `tests/api/test_api.py::test_login_issues_valid_jwt`, `::test_student_forbidden_from_admin_only_endpoint` | ✅ |

## Cross-cutting integration test

`tests/test_leave_gatepass_chain.py::test_full_leave_to_exit_entry_chain`
(service layer) and `tests/api/test_api.py::test_leave_approve_gatepass_exit_entry_chain`
(HTTP layer) exercise the SRS §7.3 named scenario end-to-end: Leave apply ->
Warden approve (+ mocked guardian notification) -> gate pass QR generated ->
security exit log recorded -> security entry log recorded, including a
negative case for a tampered gate-pass code being rejected (service-layer
test).

## Atomicity test

`tests/test_allocation_service.py::test_over_allocation_rolls_back_cleanly`
(service layer) and `tests/api/test_api.py::test_allocation_enforces_capacity`
(HTTP layer) implement the SRS §7.2 named scenario: forces a room to full
capacity, then attempts one more allocation, asserting the operation is
rejected (`CapacityExceededError` / HTTP 409) AND that `Room.occupiedbeds`
and the `Allocation` table are left completely unchanged after rollback.

## PG overview document features

Added on top of the SRS at the project owner's request (see
docs/SRS_AMBIGUITIES.md §15 for the SRS deviations).

| Feature | Module (service) | API | UI page | DB table(s) | Test | Status |
|---|---|---|---|---|---|---|
| Floors, beds, sharing types, floor-wise bed map | `RoomService.create_room/floor_map/free_beds` | `POST /api/rooms`, `GET /api/rooms/map`, `/rooms/{id}/free-beds` | `HostelsPage` (floor map), `FloorMap` | room, bed | `test_room_hostel_service.py`, `test_settlement_and_beds.py` | ✅ |
| Floor → room → bed allocation; parent rooms never allocated | `AllocationService.manual_allocate/change_room` | `POST /api/allocations/manual`, `/change-room` | `AllocationsPage` | allocation, bed | `test_settlement_and_beds.py` | ✅ |
| Monthly rent, deposit, late fine, payment history | `FeeService.generate_monthly_rent/ensure_deposit/fine_for/pay_fee` | `POST /api/fees/generate-rent`, `GET /api/fees/*/payments`, `/fees/summary` | `FeesPage` | fee, payment | `test_fee_service.py` | ✅ |
| Vacating settlement | `SettlementService.preview/settle` | `GET /api/allocations/{id}/settlement-preview`, `POST /{id}/settle` | `AllocationsPage` (Vacate and settle) | settlement | `test_settlement_and_beds.py` | ✅ |
| Settings (due day, fine, deposit, rents, AC rate) | `SettingsService` | `GET/PUT /api/settings` | `SettingsPage` | setting | `test_fee_service.py::test_fine_rate_and_due_day_are_configurable` | ✅ |
| Weekly food menu, veg/non-veg, fryums twice a week | `MenuService` | `GET/PUT /api/food-menu` | `FoodMenuPage`, student dashboard | food_menu | `test_pg_features.py` | ✅ |
| Maintenance requests (priority, photo, assignment) | `MaintenanceService` | `/api/maintenance*` | `MaintenancePage` | maintenance_request | `test_pg_features.py` | ✅ |
| Complaints & feedback (new categories, food rating, anonymous) | `ComplaintService` | `/api/complaints*` | `ComplaintsPage` | complaint | `test_complaint_service.py` | ✅ |
| AC electricity billing | `ACService` | `/api/ac/*` | `ACBillingPage`, student dashboard (request AC) | room.acstatus, ac_reading, fee | `test_pg_features.py` | ✅ |
| Parent accommodation (free) | `ParentService` | `/api/parents/*` | `ParentAccommodationPage` | parent_guest | `test_pg_features.py` | ✅ |
| Announcements / notice board | `AnnouncementService` | `/api/announcements` | `NoticesPage`, student dashboard | announcement | `test_pg_features.py` | ✅ |
| Admin dashboard statistics and charts | `DashboardService.admin_summary` | `GET /api/dashboard/admin` | `AdminDashboard` | (aggregates) | `tests/api/test_access_control.py` | ✅ |
| Student profile fields (email, college, course, year, joining date, food preference, photo) | `StudentService` | `/api/students*` | `StudentsPage` | student | `tests/api` | ✅ |
| Role access to all new endpoints | service `require_role` / `ensure_self_or_role` | – | – | – | `tests/api/test_access_control.py` | ✅ |
