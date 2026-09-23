import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { EmptyState, LoadingState } from '../components/Feedback';
import { PageHeader } from '../components/PageHeader';
import { Card, StatCard } from '../components/Card';
import { Badge } from '../components/Badge';
import {
  allocationsApi,
  attendanceApi,
  complaintsApi,
  feesApi,
  leavesApi,
  roomsApi,
  visitorsApi,
} from '../api/endpoints';
import type { AbsenteeAlert, Allocation, Fee, Leave, OccupancyRow, SecurityDashboardRow } from '../types';

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === 'Admin') return <AdminDashboard />;
  if (user.role === 'Student') return <StudentDashboard studentId={user.entity_id} />;
  if (user.role === 'Warden') return <WardenDashboard />;
  return <StaffDashboard />;
}

function AdminDashboard() {
  const { showError } = useToast();
  const [occupancy, setOccupancy] = useState<OccupancyRow[]>([]);
  const [pendingFees, setPendingFees] = useState(0);
  const [openComplaints, setOpenComplaints] = useState(0);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rooms, complaints, leaves] = await Promise.all([
          roomsApi.occupancy(),
          complaintsApi.list(),
          leavesApi.pending(),
        ]);
        setOccupancy(rooms);
        setOpenComplaints(complaints.filter((c) => c.status.toUpperCase() !== 'CLOSED' && c.status.toUpperCase() !== 'RESOLVED').length);
        setPendingLeaves(leaves.length);
        // Pending fees isn't listable in bulk without a studentid; approximate via allocations count is not fee data,
        // so we skip a global count if the endpoint doesn't support it and show 0 with a note.
        setPendingFees(-1);
      } catch (err) {
        showError(err, 'Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [showError]);

  const totalCapacity = occupancy.reduce((s, r) => s + r.capacity, 0);
  const totalOccupied = occupancy.reduce((s, r) => s + r.occupied, 0);
  const occupancyPct = totalCapacity ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="Institution-wide overview" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Occupancy" value={loading ? '…' : `${occupancyPct}%`} hint={`${totalOccupied} of ${totalCapacity} beds occupied`} tone="primary" />
        <StatCard label="Open Complaints" value={loading ? '…' : openComplaints} tone="warning" />
        <StatCard label="Pending Leaves" value={loading ? '…' : pendingLeaves} tone="info" />
        <StatCard
          label="Pending Fees"
          value={pendingFees === -1 ? '—' : pendingFees}
          hint="Look up per student on the Fees page"
          tone="danger"
        />
      </div>
      <Card title="Room occupancy" className="mt-6">
        {loading ? (
          <LoadingState />
        ) : occupancy.length === 0 ? (
          <EmptyState title="No occupancy data" hint="Rooms will appear here once hostels are configured." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {occupancy.slice(0, 12).map((r) => (
              <div key={`${r.hostel}-${r.room}`} className="rounded-lg border border-neutral-200 p-3 text-xs">
                <div className="font-semibold text-neutral-700">{r.hostel} · {r.room}</div>
                <div className="mt-1 text-neutral-500">{r.occupied}/{r.capacity} occupied ({r.type})</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StudentDashboard({ studentId }: { studentId: number | null }) {
  const { showError } = useToast();
  const [fees, setFees] = useState<Fee[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [activeAllocation, setActiveAllocation] = useState<Allocation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [f, l, a] = await Promise.all([
          feesApi.me(),
          leavesApi.me(),
          allocationsApi.forStudent(studentId),
        ]);
        setFees(f);
        setLeaves(l);
        setActiveAllocation(a);
      } catch (err) {
        showError(err, 'Failed to load your dashboard.');
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId, showError]);

  const activeLeave = leaves.find((l) => l.status.toUpperCase() === 'APPROVED');
  const pendingFee = fees.find((f) => f.paymentstatus.toUpperCase() !== 'PAID');

  return (
    <div>
      <PageHeader title="My Dashboard" subtitle="Your room, fees and leave at a glance" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card title="Current room">
          {loading ? (
            <LoadingState />
          ) : activeAllocation ? (
            <div>
              <div className="text-2xl font-semibold tracking-tight text-neutral-900">Room #{activeAllocation.roomid}</div>
              <div className="mt-1 text-xs text-neutral-500">Since {activeAllocation.allocationdate}</div>
            </div>
          ) : (
            <EmptyState title="No active allocation" />
          )}
        </Card>
        <Card title="Fee status">
          {loading ? (
            <LoadingState />
          ) : pendingFee ? (
            <div>
              <Badge status={pendingFee.paymentstatus} />
              <div className="mt-1.5 text-sm text-neutral-600">
                ₹{pendingFee.amountdue - pendingFee.amountpaid} due by {pendingFee.duedate}
              </div>
            </div>
          ) : (
            <Badge status="PAID" />
          )}
        </Card>
        <Card title="Active leave">
          {loading ? (
            <LoadingState />
          ) : activeLeave ? (
            <div>
              <Badge status={activeLeave.status} />
              <div className="mt-1.5 text-xs text-neutral-500">
                {activeLeave.startdate} → {activeLeave.enddate}
              </div>
            </div>
          ) : (
            <EmptyState title="No active leave" />
          )}
        </Card>
      </div>
    </div>
  );
}

function WardenDashboard() {
  const { showError } = useToast();
  const [pending, setPending] = useState<Leave[]>([]);
  const [alerts, setAlerts] = useState<AbsenteeAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [p, a] = await Promise.all([leavesApi.pending(), attendanceApi.alerts()]);
        setPending(p);
        setAlerts(a);
      } catch (err) {
        showError(err, 'Failed to load warden dashboard.');
      } finally {
        setLoading(false);
      }
    })();
  }, [showError]);

  return (
    <div>
      <PageHeader title="Warden Dashboard" subtitle="Approvals and attendance that need attention" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Pending leave approvals" value={loading ? '…' : pending.length} tone="warning" />
        <StatCard label="Attendance alerts" value={loading ? '…' : alerts.length} tone="danger" />
      </div>
      <Card title="Consecutive-absence alerts" className="mt-6">
        {loading ? (
          <LoadingState />
        ) : alerts.length === 0 ? (
          <EmptyState title="No attendance alerts" hint="No students with concerning absence patterns." />
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {alerts.map((a) => (
              <li key={a.studentid} className="flex items-center justify-between py-2.5">
                <span className="text-neutral-800">{a.name} <span className="text-neutral-500">({a.rollnumber})</span></span>
                <span className="inline-flex items-center rounded-full bg-danger-100 px-2.5 py-0.5 text-xs font-semibold text-danger-700">
                  {a.consecutive_absent_days} days absent
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StaffDashboard() {
  const { showError } = useToast();
  const [rows, setRows] = useState<SecurityDashboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setRows(await visitorsApi.dashboard());
      } catch (err) {
        showError(err, 'Failed to load visitor dashboard.');
      } finally {
        setLoading(false);
      }
    })();
  }, [showError]);

  const overstaying = rows.filter((r) => r.overstaying);

  return (
    <div>
      <PageHeader title="Staff Dashboard" subtitle="Visitors currently on premises" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Visitors on premises" value={loading ? '…' : rows.length} tone="info" />
        <StatCard label="Visitors overstaying" value={loading ? '…' : overstaying.length} tone="danger" />
      </div>
      <Card title="On-premises visitors" className="mt-6">
        {loading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState title="No visitors on premises" hint="Checked-in visitors will appear here." />
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {rows.map((r) => (
              <li key={r.visitorid} className="flex items-center justify-between py-2.5">
                <span>
                  {r.visitorname} → Student #{r.studentid} ({r.hours_in.toFixed(1)}h)
                </span>
                {r.overstaying ? <Badge status="OVERSTAYING" /> : <Badge status="ON PREMISES" />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
