import { api } from './client';
import type {
  AbsenteeAlert,
  Allocation,
  Bed,
  Attendance,
  Complaint,
  CriticalChangeRequest,
  Fee,
  FinanceSummary,
  Hostel,
  HostelCreate,
  Leave,
  LoginResponse,
  MapHostel,
  OccupancyRow,
  Payment,
  Room,
  RoomCreate,
  SecurityDashboardRow,
  Settlement,
  SettlementPreview,
  SettingsValues,
  Staff,
  StaffCreate,
  Student,
  StudentCreate,
  StudentSelfUpdate,
  StudentUpdate,
  Visitor,
} from '../types';

// ---- Auth ----
export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { username, password }),
  me: () => api.get<LoginResponse>('/auth/me'),
  changePassword: (new_password: string) =>
    api.post<void>('/auth/change-password', { new_password }),
};

// ---- Students ----
export const studentsApi = {
  list: () => api.get<Student[]>('/students'),
  get: (id: number) => api.get<Student>(`/students/${id}`),
  me: () => api.get<Student>('/students/me'),
  create: (payload: StudentCreate) => api.post<Student>('/students', payload),
  update: (id: number, payload: StudentUpdate) => api.put<Student>(`/students/${id}`, payload),
  remove: (id: number) => api.del<void>(`/students/${id}`),
  updateMyProfile: (payload: StudentSelfUpdate) =>
    api.put<Student>('/students/me/profile', payload),
  requestChange: (payload: CriticalChangeRequest) =>
    api.post<void>('/students/me/request-change', payload),
  approveChange: (id: number, approved_fields: Record<string, unknown>) =>
    api.post<Student>(`/students/${id}/approve-change`, { approved_fields }),
};

// ---- Hostels & Rooms ----
export const hostelsApi = {
  list: () => api.get<Hostel[]>('/hostels'),
  create: (payload: HostelCreate) => api.post<Hostel>('/hostels', payload),
  assignWarden: (hostelid: number, staffid: number) =>
    api.post<void>(`/hostels/${hostelid}/assign-warden`, { staffid }),
  setMaintenanceStatus: (hostelid: number, status: string) =>
    api.post<void>(`/hostels/${hostelid}/maintenance-status`, { status }),
};

export const roomsApi = {
  list: (hostelid?: number) => api.get<Room[]>('/rooms', { hostelid }),
  create: (payload: RoomCreate) => api.post<Room>('/rooms', payload),
  occupancy: () => api.get<OccupancyRow[]>('/rooms/occupancy'),
  map: () => api.get<MapHostel[]>('/rooms/map'),
  freeBeds: (roomid: number) => api.get<Bed[]>(`/rooms/${roomid}/free-beds`),
};

// ---- Allocations ----
export const allocationsApi = {
  listActive: () => api.get<Allocation[]>('/allocations'),
  forStudent: (studentid: number) => api.get<Allocation | null>(`/allocations/student/${studentid}`),
  auto: (studentid: number, alloc_date?: string) =>
    api.post<Allocation>('/allocations/auto', { studentid, alloc_date }),
  manual: (studentid: number, roomid: number, bedid?: number | null, alloc_date?: string) =>
    api.post<Allocation>('/allocations/manual', { studentid, roomid, bedid, alloc_date }),
  vacate: (allocationid: number, vacate_date?: string) =>
    api.post<Allocation>(`/allocations/${allocationid}/vacate`, { vacate_date }),
  changeRoom: (studentid: number, new_roomid: number, bedid?: number | null, change_date?: string) =>
    api.post<Allocation>('/allocations/change-room', { studentid, new_roomid, bedid, change_date }),
  settlementPreview: (allocationid: number) => api.get<SettlementPreview>(`/allocations/${allocationid}/settlement-preview`),
  settle: (allocationid: number, deduction: number, reason?: string) =>
    api.post<Settlement>(`/allocations/${allocationid}/settle`, { deduction, reason }),
  settlementsForStudent: (studentid: number) => api.get<Settlement[]>(`/allocations/settlements/student/${studentid}`),
};

// ---- Fees ----
export const feesApi = {
  generateRent: (period: string) => api.post<Fee[]>('/fees/generate-rent', { period }),
  summary: () => api.get<FinanceSummary>('/fees/summary'),
  forStudent: (studentid: number) => api.get<Fee[]>(`/fees/student/${studentid}`),
  paymentsForStudent: (studentid: number) => api.get<Payment[]>(`/fees/student/${studentid}/payments`),
  me: () => api.get<Fee[]>('/fees/me'),
  myPayments: () => api.get<Payment[]>('/fees/me/payments'),
  pay: (feeid: number, amount: number) => api.post<Fee>(`/fees/${feeid}/pay`, { amount }),
  markOverdue: () => api.post<{ marked_overdue: number }>('/fees/mark-overdue'),
};

// ---- Complaints ----
export const complaintsApi = {
  list: () => api.get<Complaint[]>('/complaints'),
  me: () => api.get<Complaint[]>('/complaints/me'),
  create: (category: string, description: string) =>
    api.post<Complaint>('/complaints', { category, description }),
  setStatus: (complaintid: number, new_status: string) =>
    api.post<Complaint>(`/complaints/${complaintid}/status`, { new_status }),
};

// ---- Visitors ----
export const visitorsApi = {
  dashboard: () => api.get<SecurityDashboardRow[]>('/visitors/dashboard'),
  forStudent: (studentid: number) => api.get<Visitor[]>(`/visitors/student/${studentid}`),
  logEntry: (visitorname: string, studentid: number, relationship: string, contactnumber?: string) =>
    api.post<Visitor>('/visitors', { visitorname, studentid, relationship, contactnumber }),
  logExit: (visitorid: number) => api.post<Visitor>(`/visitors/${visitorid}/exit`),
};

// ---- Attendance ----
export const attendanceApi = {
  forDate: (on_date: string) => api.get<Attendance[]>(`/attendance/date/${on_date}`),
  mark: (studentid: number, on_date: string, status: string) =>
    api.post<Attendance>('/attendance', { studentid, on_date, status }),
  alerts: () => api.get<AbsenteeAlert[]>('/attendance/alerts'),
};

// ---- Leaves ----
export const leavesApi = {
  pending: () => api.get<Leave[]>('/leaves/pending'),
  me: () => api.get<Leave[]>('/leaves/me'),
  forStudent: (studentid: number) => api.get<Leave[]>(`/leaves/student/${studentid}`),
  apply: (startdate: string, enddate: string, reason: string) =>
    api.post<Leave>('/leaves', { startdate, enddate, reason }),
  decide: (leaveid: number, approve: boolean) =>
    api.post<Leave>(`/leaves/${leaveid}/decide`, { approve }),
  securityExit: (gatepass_code: string, studentid: number) =>
    api.post<Leave>('/leaves/security/exit', { gatepass_code, studentid }),
  securityEntry: (gatepass_code: string, studentid: number) =>
    api.post<Leave>('/leaves/security/entry', { gatepass_code, studentid }),
};

// ---- Staff ----
export const staffApi = {
  list: () => api.get<Staff[]>('/staff'),
  get: (id: number) => api.get<Staff>(`/staff/${id}`),
  create: (payload: StaffCreate) => api.post<Staff>('/staff', payload),
};

// ---- Settings ----
export const settingsApi = {
  get: () => api.get<{ values: SettingsValues }>('/settings'),
  update: (values: Record<string, number>) => api.put<{ values: SettingsValues }>('/settings', { values }),
};
