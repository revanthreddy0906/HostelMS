export type Role = 'Admin' | 'Warden' | 'Staff' | 'Student';

export interface LoginResponse {
  access_token: string;
  token_type?: string;
  userid: number;
  username: string;
  role: Role;
  entity_id: number | null;
}

export interface Student {
  studentid: number;
  userid: number;
  rollnumber: string;
  firstname: string;
  lastname: string;
  gender: string;
  contactphone: string;
  guardianphone: string;
  dateofbirth: string;
  emergencycontact?: string | null;
  bloodgroup?: string | null;
  medicalhistory?: string | null;
}

export interface StudentCreate {
  username: string;
  plain_password: string;
  rollnumber: string;
  firstname: string;
  lastname: string;
  gender: string;
  contactphone: string;
  guardianphone: string;
  dateofbirth: string;
  emergencycontact?: string | null;
  bloodgroup?: string | null;
  medicalhistory?: string | null;
}

export type StudentUpdate = Partial<StudentCreate> & { rollnumber?: string | null };

export interface StudentSelfUpdate {
  contactphone?: string | null;
  guardianphone?: string | null;
  emergencycontact?: string | null;
  bloodgroup?: string | null;
  medicalhistory?: string | null;
}

export interface CriticalChangeRequest {
  rollnumber?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  gender?: string | null;
  dateofbirth?: string | null;
}

export interface Hostel {
  hostelid: number;
  hostelname: string;
  gendertype: string;
  totalrooms: number;
  maintenancestatus?: string | null;
  wardenstaffid?: number | null;
}

export interface HostelCreate {
  hostelname: string;
  gendertype: string;
  totalrooms: number;
  maintenancestatus?: string;
  wardenstaffid?: number | null;
}

export type SharingType = '3 Sharing' | '4 Sharing' | '5 Sharing' | 'Pentahouse';

export interface Room {
  roomid: number;
  hostelid: number;
  roomnumber: string;
  floor: number;
  capacity: number;
  occupiedbeds: number;
  /** Sharing type ('3 Sharing' … 'Pentahouse'), or 'Parent' for parent rooms */
  roomtype: string;
  monthlyrent: number;
  acstatus: 'None' | 'Requested' | 'Active';
  purpose: 'Student' | 'Parent';
}

export interface RoomCreate {
  hostelid: number;
  roomnumber: string;
  roomtype: string;
  floor: number;
  capacity?: number | null;
  purpose?: 'Student' | 'Parent';
  monthlyrent?: number | null;
}

export interface Bed {
  bedid: number;
  roomid: number;
  bednumber: number;
}

export interface MapBed {
  bedid: number;
  bednumber: number;
  studentid: number | null;
  studentname: string | null;
}

export interface MapRoom {
  roomid: number;
  roomnumber: string;
  roomtype: string;
  purpose: 'Student' | 'Parent';
  capacity: number;
  occupiedbeds: number;
  monthlyrent: number;
  acstatus: 'None' | 'Requested' | 'Active';
  beds: MapBed[];
}

export interface MapHostel {
  hostelid: number;
  hostelname: string;
  gendertype: string;
  floors: { floor: number; rooms: MapRoom[] }[];
}

export interface OccupancyRow {
  hostel: string;
  floor: number;
  room: string;
  type: string;
  purpose: 'Student' | 'Parent';
  rent: number;
  capacity: number;
  occupied: number;
  free: number;
}

export interface Allocation {
  allocationid: number;
  studentid: number;
  roomid: number;
  allocationdate: string;
  vacatedate?: string | null;
  status: string;
  bedid?: number | null;
  bednumber?: number | null;
}

export type BillType = 'Rent' | 'Deposit' | 'AC';

export interface Fee {
  feeid: number;
  studentid: number;
  billtype: BillType;
  /** 'YYYY-MM' for rent and AC bills */
  period?: string | null;
  amountdue: number;
  amountpaid: number;
  duedate: string;
  paymentstatus: string;
  txnreference?: string | null;
  /** Live late fine for unpaid rent, frozen once paid */
  latefine: number;
  latedays?: number | null;
  totalpayable: number;
  balance: number;
  paidon?: string | null;
}

export interface Payment {
  paymentid: number;
  feeid: number;
  amount: number;
  paidat: string;
  method: 'Online' | 'Cash' | 'Settlement';
  txnreference?: string | null;
}

export interface FinanceSummary {
  outstanding: { Rent: number; Deposit: number; AC: number; fines: number };
  overdue_bills: number;
  collected_this_month: number;
}

export interface SettlementPreview {
  allocationid: number;
  studentid: number;
  vacatedate: string;
  depositheld: number;
  pendingdues: number;
  pendingbills: Fee[];
  availablefordeduction: number;
  balanceowed: number;
}

export interface Settlement {
  settlementid: number;
  allocationid: number;
  studentid: number;
  vacatedate: string;
  depositheld: number;
  pendingdues: number;
  deduction: number;
  deductionreason?: string | null;
  refund: number;
  balanceowed: number;
}

export type SettingsValues = Record<string, string>;

export interface Complaint {
  complaintid: number;
  studentid: number;
  category: string;
  description: string;
  status: string;
  createdat: string;
  assignedstaffid?: number | null;
}

export interface Visitor {
  visitorid: number;
  visitorname: string;
  studentid: number;
  intime: string;
  outtime?: string | null;
  contactnumber?: string | null;
}

export interface SecurityDashboardRow {
  visitorid: number;
  visitorname: string;
  studentid: number;
  intime: string;
  hours_in: number;
  overstaying: boolean;
}

export interface Attendance {
  attendanceid: number;
  studentid: number;
  date: string;
  status: string;
  markedby: number;
}

export interface AbsenteeAlert {
  studentid: number;
  rollnumber: string;
  name: string;
  consecutive_absent_days: number;
}

export interface Leave {
  leaveid: number;
  studentid: number;
  startdate: string;
  enddate: string;
  reason: string;
  status: string;
  approvedby?: number | null;
  gatepasscode?: string | null;
  exitlogged?: string | null;
  entrylogged?: string | null;
}

export interface Staff {
  staffid: number;
  userid: number;
  fullname: string;
  designation: string;
  assignedblock: number;
}

export interface StaffCreate {
  username: string;
  plain_password: string;
  fullname: string;
  designation: string;
  assignedblock: number;
  role?: string;
}
