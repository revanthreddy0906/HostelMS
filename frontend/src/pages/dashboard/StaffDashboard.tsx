import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, IdCard, QrCode, TimerOff, Wrench } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { attendanceApi, maintenanceApi, studentsApi, visitorsApi } from '@/api/endpoints';
import type { Attendance, MaintenanceRequest, SecurityDashboardRow, Student } from '@/types';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BorderBeam } from '@/components/ui/border-beam';
import { cn } from '@/lib/utils';
import { DashboardHeader, EmptyNote, KpiCard, ListSkeleton, Stat, useReduceMotion } from './shared';

const OPEN_STATUSES = new Set(['Assigned', 'In Progress']);

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatHours(h: number) {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return whole ? `${whole}h ${mins}m` : `${mins}m`;
}

export function StaffDashboard() {
  const { user } = useAuth();
  const { showError } = useToast();
  const reduceMotion = useReduceMotion();
  const [visitors, setVisitors] = useState<SecurityDashboardRow[]>([]);
  const [jobs, setJobs] = useState<MaintenanceRequest[]>([]);
  const [rollCall, setRollCall] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [v, c, r, s] = await Promise.all([
          visitorsApi.dashboard(),
          maintenanceApi.list(),
          attendanceApi.forDate(todayISO()),
          studentsApi.list(),
        ]);
        setVisitors(v);
        setJobs(c);
        setRollCall(r);
        setStudents(s);
      } catch (err) {
        showError(err, 'Failed to load staff dashboard.');
      } finally {
        setLoading(false);
      }
    })();
  }, [showError]);

  const studentById = useMemo(() => new Map(students.map((s) => [s.studentid, s])), [students]);
  const hostOf = (id: number) => {
    const s = studentById.get(id);
    return s ? `${s.firstname} ${s.lastname} (${s.rollnumber})` : `Student #${id}`;
  };

  const overstaying = visitors.filter((v) => v.overstaying);
  const sortedVisitors = [...visitors].sort((a, b) => Number(b.overstaying) - Number(a.overstaying) || b.hours_in - a.hours_in);
  const myTickets = jobs.filter((j) => j.assignedstaffid === user?.entity_id && OPEN_STATUSES.has(j.status));
  const marked = new Set(rollCall.map((r) => r.studentid)).size;

  return (
    <div className="space-y-6">
      <DashboardHeader title="Staff dashboard" subtitle="Gate, visitors and your assigned tickets" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Visitors on premises" icon={IdCard} to="/visitors" loading={loading} footer="Checked in, not yet out">
          <Stat value={visitors.length} />
        </KpiCard>
        <KpiCard title="Overstaying" icon={TimerOff} to="/visitors" tone="danger" loading={loading} footer="Past maximum visiting hours">
          <Stat value={overstaying.length} />
        </KpiCard>
        <KpiCard title="My repair jobs" icon={Wrench} to="/maintenance" tone="warning" loading={loading} footer="Assigned to you">
          <Stat value={myTickets.length} />
        </KpiCard>
        <KpiCard title="Roll call today" icon={ClipboardCheck} to="/attendance" loading={loading} footer={`of ${students.length} students marked`}>
          <Stat value={marked} />
        </KpiCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="relative overflow-hidden lg:col-span-2">
          {!loading && overstaying.length > 0 && !reduceMotion && (
            <BorderBeam size={100} duration={7} colorFrom="#f87171" colorTo="#dc2626" />
          )}
          <CardHeader>
            <CardTitle>On premises now</CardTitle>
            <CardDescription>Overstaying visitors are listed first</CardDescription>
            <CardAction>
              <Button asChild size="sm" variant="ghost">
                <Link to="/visitors">
                  Visitor log <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ListSkeleton />
            ) : visitors.length === 0 ? (
              <EmptyNote>No visitors on premises.</EmptyNote>
            ) : (
              <ul className="divide-y rounded-lg border">
                {sortedVisitors.map((v) => (
                  <li key={v.visitorid} className={cn('flex items-center gap-3 p-3', v.overstaying && 'bg-red-50/60')}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{v.visitorname}</div>
                      <div className="truncate text-xs text-muted-foreground">Visiting {hostOf(v.studentid)}</div>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatHours(v.hours_in)}</span>
                    <Badge status={v.overstaying ? 'OVERSTAYING' : 'ON PREMISES'} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gate pass check</CardTitle>
              <CardDescription>Verify a student's out-pass and log their exit or return</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/leaves">
                  <QrCode /> Verify gate pass
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>My tickets</CardTitle>
              <CardDescription>Open repair jobs assigned to you</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <ListSkeleton rows={2} />
              ) : myTickets.length === 0 ? (
                <EmptyNote>Nothing assigned right now.</EmptyNote>
              ) : (
                <ul className="space-y-2">
                  {myTickets.slice(0, 5).map((c) => (
                    <li key={c.requestid} className="rounded-md border px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{c.category}</span>
                        <Badge status={c.status} />
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{c.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
