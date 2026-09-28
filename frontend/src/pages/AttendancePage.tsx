import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { EmptyState, LoadingState } from '../components/Feedback';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { PersonCell } from '../components/PersonCell';
import { attendanceApi, studentsApi } from '../api/endpoints';
import type { AbsenteeAlert, Attendance, Student } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type Status = 'Present' | 'Absent' | 'On Leave';
const STATUSES: { value: Status; short: string; active: string }[] = [
  { value: 'Present', short: 'Present', active: 'bg-emerald-600 text-white hover:bg-emerald-600' },
  { value: 'Absent', short: 'Absent', active: 'bg-red-600 text-white hover:bg-red-600' },
  { value: 'On Leave', short: 'On leave', active: 'bg-sky-600 text-white hover:bg-sky-600' },
];

function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDate(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  return localISO(new Date(y, m - 1, d + days));
}

export function AttendancePage() {
  const { user } = useAuth();
  const canSeeAlerts = user?.role === 'Warden' || user?.role === 'Admin';
  const { showToast, showError } = useToast();
  const today = localISO(new Date());
  const [date, setDate] = useState(today);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Map<number, Status>>(new Map());
  const [alerts, setAlerts] = useState<AbsenteeAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    studentsApi.list().then(setStudents).catch((err) => showError(err, 'Failed to load students.'));
    if (canSeeAlerts) attendanceApi.alerts().then(setAlerts).catch((err) => showError(err, 'Failed to load absence alerts.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    attendanceApi
      .forDate(date)
      .then((records: Attendance[]) => setMarks(new Map(records.map((r) => [r.studentid, r.status as Status]))))
      .catch((err) => showError(err, 'Failed to load attendance.'))
      .finally(() => setLoading(false));
  }, [date, showError]);

  async function mark(studentid: number, status: Status) {
    const previous = marks.get(studentid);
    setMarks((m) => new Map(m).set(studentid, status));
    setSaving((s) => new Set(s).add(studentid));
    try {
      await attendanceApi.mark(studentid, date, status);
    } catch (err) {
      setMarks((m) => {
        const next = new Map(m);
        if (previous) next.set(studentid, previous);
        else next.delete(studentid);
        return next;
      });
      showError(err, 'Failed to mark attendance.');
    } finally {
      setSaving((s) => {
        const next = new Set(s);
        next.delete(studentid);
        return next;
      });
    }
  }

  async function markRemainingPresent() {
    const remaining = students.filter((s) => !marks.has(s.studentid));
    if (!remaining.length) return;
    setBulkSaving(true);
    const results = await Promise.allSettled(remaining.map((s) => attendanceApi.mark(s.studentid, date, 'Present')));
    const ok = remaining.filter((_, i) => results[i].status === 'fulfilled');
    setMarks((m) => {
      const next = new Map(m);
      ok.forEach((s) => next.set(s.studentid, 'Present'));
      return next;
    });
    setBulkSaving(false);
    if (ok.length === remaining.length) showToast(`${ok.length} students marked present.`, 'success');
    else showError(null, `Marked ${ok.length} of ${remaining.length}; try the rest again.`);
  }

  const counts = useMemo(() => {
    const c = { Present: 0, Absent: 0, 'On Leave': 0 } as Record<Status, number>;
    marks.forEach((v) => (c[v] = (c[v] ?? 0) + 1));
    return c;
  }, [marks]);

  const marked = students.filter((s) => marks.has(s.studentid)).length;
  const pct = students.length ? Math.round((marked / students.length) * 100) : 0;
  const q = query.trim().toLowerCase();
  const visible = q ? students.filter((s) => `${s.firstname} ${s.lastname} ${s.rollnumber}`.toLowerCase().includes(q)) : students;
  const alertIds = new Set(alerts.map((a) => a.studentid));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        subtitle="Evening roll call"
        actions={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">
              <ChevronLeft />
            </Button>
            <Input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-9 w-40" aria-label="Roll call date" />
            <Button variant="ghost" size="sm" onClick={() => setDate(shiftDate(date, 1))} disabled={date >= today} aria-label="Next day">
              <ChevronRight />
            </Button>
            {date !== today && (
              <Button variant="secondary" size="sm" onClick={() => setDate(today)}>
                Today
              </Button>
            )}
          </div>
        }
      />

      <div className={cn('grid grid-cols-1 gap-6', canSeeAlerts && 'xl:grid-cols-[minmax(0,1fr)_320px]')}>
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Roll call for {new Date(date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</CardTitle>
            <CardDescription>
              {marked} of {students.length} marked · {counts.Present} present · {counts.Absent} absent · {counts['On Leave']} on leave
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={pct} className="h-1.5" aria-label="Roll call progress" />
            <div className="flex flex-wrap items-center gap-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a student" aria-label="Find a student" className="h-9 max-w-xs" />
              <Button
                variant="secondary"
                size="sm"
                className="ml-auto"
                onClick={markRemainingPresent}
                loading={bulkSaving}
                disabled={loading || marked === students.length}
              >
                <CheckCheck /> Mark remaining present
              </Button>
            </div>
            {loading ? (
              <LoadingState />
            ) : visible.length === 0 ? (
              <EmptyState title={students.length ? 'No students match' : 'No students yet'} />
            ) : (
              <ul className="divide-y rounded-lg border">
                {visible.map((s) => {
                  const current = marks.get(s.studentid);
                  return (
                    <li key={s.studentid} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <PersonCell name={`${s.firstname} ${s.lastname}`} sub={s.rollnumber} />
                        {alertIds.has(s.studentid) && <AlertTriangle className="size-4 shrink-0 text-red-600" aria-label="Absence alert" />}
                      </div>
                      <div role="radiogroup" aria-label={`Attendance for ${s.firstname} ${s.lastname}`} className="inline-flex rounded-lg border p-0.5">
                        {STATUSES.map((st) => (
                          <button
                            key={st.value}
                            type="button"
                            role="radio"
                            aria-checked={current === st.value}
                            disabled={saving.has(s.studentid)}
                            onClick={() => current !== st.value && mark(s.studentid, st.value)}
                            className={cn(
                              'rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
                              current === st.value && st.active,
                            )}
                          >
                            {st.short}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {canSeeAlerts && (
          <Card className="h-fit gap-4">
            <CardHeader>
              <CardTitle>Absence alerts</CardTitle>
              <CardDescription>Absent on consecutive days</CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <EmptyState title="No alerts" hint="No students with concerning absence patterns." />
              ) : (
                <ul className="space-y-2">
                  {alerts.map((a) => (
                    <li key={a.studentid} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                      <PersonCell name={a.name} sub={a.rollnumber} />
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{a.consecutive_absent_days} days</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
