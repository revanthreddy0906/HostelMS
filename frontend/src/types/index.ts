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

export interface Room {
  roomid: number;
  hostelid: number;
  roomnumber: string;
  capacity: number;
  occupiedbeds: number;
  roomtype: string;
}

export interface RoomCreate {
  hostelid: number;
  roomnumber: string;
  capacity: number;
  roomtype: string;
}

export interface OccupancyRow {
  hostel: string;
  room: string;
  type: string;
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
}

export interface Fee {
  feeid: number;
  studentid: number;
  amountdue: number;
  amountpaid: number;
  duedate: string;
  paymentstatus: string;
  txnreference?: string | null;
}

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
