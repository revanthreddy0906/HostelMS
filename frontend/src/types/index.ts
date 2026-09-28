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
  email?: string | null;
  college?: string | null;
  course?: string | null;
  yearofstudy?: string | null;
  foodpreference?: 'Veg' | 'Non-Veg' | null;
  photo?: string | null;
  joiningdate?: string | null;
  residentstatus: 'ACTIVE' | 'VACATED' | 'NEW';
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
  email?: string | null;
  college?: string | null;
  course?: string | null;
  yearofstudy?: string | null;
  foodpreference?: 'Veg' | 'Non-Veg' | null;
  photo?: string | null;
  joiningdate?: string | null;
}

export type StudentUpdate = Partial<StudentCreate> & { rollnumber?: string | null };

export interface StudentSelfUpdate {
  contactphone?: string | null;
  guardianphone?: string | null;
  emergencycontact?: string | null;
  bloodgroup?: string | null;
  medicalhistory?: string | null;
  email?: string | null;
  college?: string | null;
  course?: string | null;
  yearofstudy?: string | null;
  foodpreference?: 'Veg' | 'Non-Veg' | null;
  photo?: string | null;
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
  /** null for anonymous complaints seen by staff */
  studentid: number | null;
  category: string;
  description: string;
  status: string;
  createdat: string;
  meal?: 'Breakfast' | 'Lunch' | 'Dinner' | null;
  mealdate?: string | null;
  rating?: number | null;
  isanonymous: boolean;
}

export interface ComplaintCreate {
  category: string;
  description: string;
  meal?: string | null;
  mealdate?: string | null;
  rating?: number | null;
  isanonymous?: boolean;
}

export interface MaintenanceRequest {
  requestid: number;
  studentid: number;
  roomid?: number | null;
  category: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Emergency';
  status: 'Pending' | 'Assigned' | 'In Progress' | 'Resolved' | 'Rejected';
  assignedstaffid?: number | null;
  photo?: string | null;
  resolutionnote?: string | null;
  createdat: string;
  updatedat: string;
}

export interface MenuDay {
  day: string;
  breakfast: string;
  lunch: string;
  lunchnonveg?: string | null;
  dinner: string;
  dinnernonveg?: string | null;
  fryums: boolean;
}

export interface ACRoom {
  roomid: number;
  roomnumber: string;
  hostelname: string;
  floor: number;
  acstatus: 'Requested' | 'Active';
  occupants: number;
  lastreading?: number | null;
  lastperiod?: string | null;
}

export interface ACReading {
  readingid: number;
  roomid: number;
  period: string;
  previousreading: number;
  currentreading: number;
  rateperunit: number;
  totalamount: number;
  occupants: number;
  recordedat: string;
}

export interface ParentRoom {
  roomid: number;
  roomnumber: string;
  hostelname: string;
  floor: number;
  capacity: number;
  staying: number;
}

export interface ParentGuest {
  guestid: number;
  guestname: string;
  relation: string;
  studentid: number;
  phone: string;
  idproof: string;
  roomid: number;
  arrivaldate: string;
  departuredate: string;
  status: 'Booked' | 'Staying' | 'Departed' | 'Cancelled';
}

export type ParentGuestCreate = Omit<ParentGuest, 'guestid' | 'status'>;

export interface Announcement {
  announcementid: number;
  title: string;
  body: string;
  pinned: boolean;
  createdat: string;
}

export interface Series {
  label: string;
  value: number;
}

export interface AdminSummary {
  counts: {
    active_students: number;
    vacated_students: number;
    awaiting_room: number;
    total_rooms: number;
    occupied_rooms: number;
    available_beds: number;
    total_beds: number;
    revenue_this_month: number;
    pending_fees: number;
    open_maintenance: number;
    open_complaints: number;
    ac_bills_pending: number;
    parent_rooms_occupied: number;
    parent_rooms: number;
  };
  occupancy_by_floor: { label: string; occupied: number; free: number }[];
  students_by_sharing: Series[];
  revenue_by_month: { month: string; amount: number }[];
  maintenance_by_status: Series[];
  complaints_by_category: Series[];
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
