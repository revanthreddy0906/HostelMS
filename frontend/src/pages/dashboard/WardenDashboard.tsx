import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, ClipboardCheck, DoorOpen, IdCard, X } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { attendanceApi, complaintsApi, leavesApi, studentsApi, visitorsApi } from '@/api/endpoints';
import type { AbsenteeAlert, Attendance, Complaint, Leave, SecurityDashboardRow, Student } from '@/types';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BorderBeam } from '@/components/ui/border-beam';
import { DashboardHeader, EmptyNote, KpiCard, ListSkeleton, Stat, useReduceMotion } from './shared';
import { serverTime } from '@/lib/time';

const OPEN_STATUSES = new Set(['PENDING', 'REVIEWED', 'IN PROGRESS']);

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function WardenDashboard() {
  const { showError, showToast } = useToast();
  const reduceMotion = useReduceMotion();
  const [pending, setPending] = useState<Leave[]>([]);
  const [alerts, setAlerts] = useState<AbsenteeAlert[]>([]);
  const [rollCall, setRollCall] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [visitors, setVisitors] = useState<SecurityDashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, a, r, s, c, v] = await Promise.all([
          leavesApi.pending(),
          attendanceApi.alerts(),
          attendanceApi.forDate(todayISO()),
          studentsApi.list(),
          complaintsApi.list(),
          visitorsApi.dashboard(),
        ]);
        setPending(p);
        setAlerts(a);
        setRollCall(r);
        setStudents(s);
        setComplaints(c);
        setVisitors(v);
      } catch (err) {
        showError(err, 'Failed to load warden dashboard.');
      } finally {
        setLoading(false);
      }
    })();
  }, [showError]);

  const studentById = useMemo(() => new Map(students.map((s) => [s.studentid, s])), [students]);
  const nameOf = (id: number) => {
    const s = studentById.get(id);
    return s ? `${s.firstname} ${s.lastname}` : `Student #${id}`;
  };
  const rollOf = (id: number) => studentById.get(id)?.rollnumber;

  async function decide(leave: Leave, approve: boolean) {
      setDeciding(leave.leaveid);
      try {
        await leavesApi.decide(leave.leaveid, approve);
        setPending((prev) => prev.filter((l) => l.leaveid !== leave.leaveid));
        showToast(
          approve ? `Leave approved for ${nameOf(leave.studentid)}. Guardian notified.` : `Leave rejected for ${nameOf(leave.studentid)}.`,
          'success',
        );
      } catch (err) {
        showError(err, 'Could not update the leave request.');
      } finally {
        setDeciding(null);
      }
  }

  const marked = new Set(rollCall.map((r) => r.studentid)).size;
  const total = students.length;
  const rollPct = total ? Math.round((marked / total) * 100) : 0;
  const openComplaints = complaints.filter((c) => OPEN_STATUSES.has(c.status.toUpperCase()));
  const overstaying = visitors.filter((v) => v.overstaying);

  return (
    <div className="space-y-6">
      <DashboardHeader title="Warden dashboard" subtitle="Approvals, roll call and alerts" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Pending approvals" icon={DoorOpen} to="/leaves" tone="warning" loading={loading} footer="Leave and out-pass requests">
          <Stat value={pending.length} />
        </KpiCard>
        <KpiCard title="Tonight's roll call" icon={ClipboardCheck} to="/attendance" loading={loading} footer={`${marked} of ${total} students marked`}>
          <Stat value={rollPct} suffix="%" />
          <Progress value={rollPct} className="h-1.5" aria-label="Roll call progress" />
        </KpiCard>
        <KpiCard title="Absence alerts" icon={AlertTriangle} to="/attendance" tone="danger" loading={loading} footer="Absent on consecutive days">
          <Stat value={alerts.length} />
        </KpiCard>
        <KpiCard
          title="Visitors on premises"
          icon={IdCard}
          to="/visitors"
          loading={loading}
          footer={overstaying.length ? `${overstaying.length} past visiting hours` : 'None overstaying'}
        >
          <Stat value={visitors.length} />
        </KpiCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="relative overflow-hidden lg:col-span-2">
          {!loading && pending.length > 0 && !reduceMotion && (
            <BorderBeam size={100} duration={9} colorFrom="#fbbf24" colorTo="#4f46e5" />
          )}
          <CardHeader>
            <CardTitle>Leave approvals</CardTitle>
            <CardDescription>Approving notifies the student's guardian and issues a gate pass</CardDescription>
            <CardAction>
              <Button asChild size="sm" variant="ghost">
                <Link to="/leaves">
                  All leaves <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ListSkeleton />
            ) : pending.length === 0 ? (
              <EmptyNote>No requests waiting. You're all caught up.</EmptyNote>
            ) : (
              <ul className="divide-y rounded-lg border">
                {pending.map((l) => (
                  <li key={l.leaveid} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {nameOf(l.studentid)}
                        {rollOf(l.studentid) && <span className="ml-1.5 font-normal text-muted-foreground">{rollOf(l.studentid)}</span>}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {l.startdate} → {l.enddate} · {l.reason}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="outline" disabled={deciding === l.leaveid} onClick={() => decide(l, false)}>
                        <X /> Reject
                      </Button>
                      <Button size="sm" disabled={deciding === l.leaveid} onClick={() => decide(l, true)}>
                        <Check /> Approve
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Absence alerts</CardTitle>
            <CardDescription>Students missing roll call on consecutive days</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ListSkeleton rows={2} />
            ) : alerts.length === 0 ? (
              <EmptyNote>No concerning absence patterns.</EmptyNote>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li key={a.studentid} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.rollnumber}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      {a.consecutive_absent_days} days
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open complaints</CardTitle>
          <CardDescription>Maintenance and service tickets not yet resolved</CardDescription>
          <CardAction>
            <Button asChild size="sm" variant="ghost">
              <Link to="/complaints">
                Manage <ArrowRight />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ListSkeleton rows={2} />
          ) : openComplaints.length === 0 ? (
            <EmptyNote>No open complaints.</EmptyNote>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {openComplaints.slice(0, 6).map((c) => (
                <li key={c.complaintid} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{c.category}</span>
                    <Badge status={c.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {c.studentid == null ? 'Anonymous' : nameOf(c.studentid)} · {serverTime(c.createdat).toLocaleDateString('en-IN')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
