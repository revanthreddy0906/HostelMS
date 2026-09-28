import { useEffect, useMemo, useState } from 'react';
import { Check, Download, LogIn, LogOut, Plus, QrCode, ScanLine, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { EmptyState, LoadingState } from '../components/Feedback';
import { Badge } from '../components/Badge';
import { TextField, TextareaField } from '../components/Form';
import { PersonCell } from '../components/PersonCell';
import { useConfirm } from '../components/ConfirmDialog';
import { leavesApi, studentsApi } from '../api/endpoints';
import { fetchBlob } from '../api/client';
import type { Leave, Student } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button as UiButton } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { serverTime } from '@/lib/time';

const isApproved = (l: Leave) => l.status.toUpperCase() === 'APPROVED';
const fmtDateTime = (iso?: string | null) =>
  iso ? serverTime(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

function daysBetween(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Where the student is on an approved pass: not yet left, out, or back. */
function passState(l: Leave): 'ready' | 'out' | 'returned' {
  if (l.entrylogged) return 'returned';
  if (l.exitlogged) return 'out';
  return 'ready';
}

const PASS_LABEL = { ready: 'Not yet left', out: 'Out of hostel', returned: 'Returned' } as const;

export function LeavesPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'Staff') return <SecurityScanPage />;
  if (user.role === 'Student') return <StudentLeavesPage />;
  return <ApprovalLeavesPage />;
}

function GatePassImage({ leaveid }: { leaveid: number }) {
  const { showError } = useToast();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    fetchBlob(`/leaves/${leaveid}/gatepass-qr`)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => showError(err, 'Failed to load gate pass QR.'));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [leaveid, showError]);

  if (!url) return <LoadingState label="Loading QR…" />;
  return (
    <div className="flex flex-col items-center gap-3">
      <img src={url} alt={`Gate pass QR code for leave ${leaveid}`} className="size-52 rounded-lg border bg-white p-2" />
      <UiButton asChild size="sm" variant="outline">
        <a href={url} download={`gatepass-${leaveid}.png`}>
          <Download /> Download QR
        </a>
      </UiButton>
    </div>
  );
}

function StudentLeavesPage() {
  const { showToast, showError } = useToast();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyModal, setApplyModal] = useState(false);
  const [form, setForm] = useState({ startdate: '', enddate: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [qrLeave, setQrLeave] = useState<Leave | null>(null);

  async function load() {
    setLoading(true);
    try {
      setLeaves(await leavesApi.me());
    } catch (err) {
      showError(err, 'Failed to load leaves.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function apply() {
    setSaving(true);
    try {
      await leavesApi.apply(form.startdate, form.enddate, form.reason);
      showToast('Leave request sent to your warden.', 'success');
      setApplyModal(false);
      setForm({ startdate: '', enddate: '', reason: '' });
      load();
    } catch (err) {
      showError(err, 'Failed to submit leave application.');
    } finally {
      setSaving(false);
    }
  }

  const dateError = form.startdate && form.enddate && form.enddate < form.startdate ? 'Return date must be on or after the start date.' : undefined;
  const sorted = [...leaves].sort((a, b) => b.leaveid - a.leaveid);

  const columns: Column<Leave>[] = [
    {
      key: 'dates',
      header: 'Dates',
      sortValue: (l) => l.startdate,
      render: (l) => (
        <div>
          <div className="font-medium">
            {l.startdate} → {l.enddate}
          </div>
          <div className="text-xs text-muted-foreground">{daysBetween(l.startdate, l.enddate)} days</div>
        </div>
      ),
    },
    { key: 'reason', header: 'Reason', render: (l) => <span className="line-clamp-2 max-w-xs">{l.reason}</span> },
    { key: 'status', header: 'Status', render: (l) => <Badge status={l.status} /> },
    {
      key: 'movement',
      header: 'Gate',
      render: (l) =>
        isApproved(l) ? (
          <div className="text-xs">
            <div>{PASS_LABEL[passState(l)]}</div>
            {l.exitlogged && <div className="text-muted-foreground">Left {fmtDateTime(l.exitlogged)}</div>}
            {l.entrylogged && <div className="text-muted-foreground">Back {fmtDateTime(l.entrylogged)}</div>}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'gatepass',
      header: '',
      align: 'right',
      render: (l) =>
        isApproved(l) && l.gatepasscode && passState(l) !== 'returned' ? (
          <Button size="sm" variant="secondary" onClick={() => setQrLeave(l)}>
            <QrCode /> Gate pass
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="My leave"
        subtitle="Request out-passes and show your gate pass at the gate"
        actions={
          <Button onClick={() => setApplyModal(true)}>
            <Plus /> Apply for leave
          </Button>
        }
      />
      <Table
        columns={columns}
        rows={sorted}
        rowKey={(l) => l.leaveid}
        loading={loading}
        emptyMessage="No leave requests yet"
        emptyHint="Apply for leave and your warden will be notified."
      />

      <Modal
        open={applyModal}
        title="Apply for leave"
        onClose={() => setApplyModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setApplyModal(false)}>
              Cancel
            </Button>
            <Button onClick={apply} loading={saving} disabled={!form.startdate || !form.enddate || !form.reason.trim() || !!dateError}>
              Send request
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-x-4">
          <TextField label="Leaving on" type="date" min={todayISO()} value={form.startdate} onChange={(e) => setForm({ ...form, startdate: e.target.value })} />
          <TextField
            label="Returning on"
            type="date"
            min={form.startdate || todayISO()}
            value={form.enddate}
            onChange={(e) => setForm({ ...form, enddate: e.target.value })}
            error={dateError}
          />
        </div>
        <TextareaField label="Reason" placeholder="e.g. Family function at home" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <p className="text-xs text-muted-foreground">Once approved, your guardian is notified and a gate pass appears here.</p>
      </Modal>

      <Modal open={!!qrLeave} title="Gate pass" onClose={() => setQrLeave(null)}>
        {qrLeave && (
          <div className="space-y-4">
            <div className="text-center text-sm">
              <div className="font-medium">
                {qrLeave.startdate} → {qrLeave.enddate}
              </div>
              <div className="text-muted-foreground">Show this QR code to security when leaving and returning.</div>
            </div>
            <GatePassImage leaveid={qrLeave.leaveid} />
            <div className="rounded-md bg-muted px-3 py-2 text-center text-xs">
              Code <span className="font-mono font-semibold">{qrLeave.gatepasscode}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ApprovalLeavesPage() {
  const { showToast, showError } = useToast();
  const { confirm, dialog } = useConfirm();
  const [pending, setPending] = useState<Leave[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([leavesApi.pending(), studentsApi.list()]);
      setPending(p);
      setStudents(s);
    } catch (err) {
      showError(err, 'Failed to load pending leaves.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const studentById = useMemo(() => new Map(students.map((s) => [s.studentid, s])), [students]);
  const nameOf = (id: number) => {
    const s = studentById.get(id);
    return s ? `${s.firstname} ${s.lastname}` : `Student #${id}`;
  };

  async function decide(l: Leave, approve: boolean) {
    if (!approve) {
      const ok = await confirm({
        title: `Reject ${nameOf(l.studentid)}'s leave?`,
        description: `${l.startdate} → ${l.enddate}: ${l.reason}`,
        confirmLabel: 'Reject leave',
        destructive: true,
      });
      if (!ok) return;
    }
    setDeciding(l.leaveid);
    try {
      await leavesApi.decide(l.leaveid, approve);
      showToast(approve ? `Approved for ${nameOf(l.studentid)}. Guardian notified.` : `Rejected for ${nameOf(l.studentid)}.`, 'success');
      setPending((prev) => prev.filter((x) => x.leaveid !== l.leaveid));
    } catch (err) {
      showError(err, 'Failed to record decision.');
    } finally {
      setDeciding(null);
    }
  }

  const columns: Column<Leave>[] = [
    {
      key: 'student',
      header: 'Student',
      render: (l) => <PersonCell name={nameOf(l.studentid)} sub={studentById.get(l.studentid)?.rollnumber} />,
      sortValue: (l) => nameOf(l.studentid),
    },
    {
      key: 'dates',
      header: 'Dates',
      sortValue: (l) => l.startdate,
      render: (l) => (
        <div>
          <div>
            {l.startdate} → {l.enddate}
          </div>
          <div className="text-xs text-muted-foreground">{daysBetween(l.startdate, l.enddate)} days</div>
        </div>
      ),
    },
    { key: 'reason', header: 'Reason', render: (l) => <span className="line-clamp-2 max-w-xs">{l.reason}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (l) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" disabled={deciding === l.leaveid} onClick={() => decide(l, false)}>
            <X /> Reject
          </Button>
          <Button size="sm" disabled={deciding === l.leaveid} onClick={() => decide(l, true)}>
            <Check /> Approve
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Leave approvals"
        subtitle={loading ? 'Loading…' : pending.length ? `${pending.length} requests waiting for a decision` : 'No requests waiting'}
      />
      <Table
        columns={columns}
        rows={pending}
        rowKey={(l) => l.leaveid}
        loading={loading}
        emptyMessage="You're all caught up"
        emptyHint="New leave and out-pass requests will appear here."
        searchText={(l) => `${nameOf(l.studentid)} ${studentById.get(l.studentid)?.rollnumber ?? ''} ${l.reason}`}
        searchPlaceholder="Search requests"
      />
      {dialog}
    </div>
  );
}

function SecurityScanPage() {
  const { showToast, showError } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    studentsApi.list().then(setStudents).catch((err) => showError(err, 'Failed to load students.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pick(s: Student) {
    setStudent(s);
    setQuery('');
    setCode('');
    setLoadingLeaves(true);
    try {
      setLeaves((await leavesApi.forStudent(s.studentid)).filter(isApproved).sort((a, b) => b.leaveid - a.leaveid));
    } catch (err) {
      showError(err, 'Failed to load this student’s passes.');
    } finally {
      setLoadingLeaves(false);
    }
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return students.filter((s) => `${s.firstname} ${s.lastname} ${s.rollnumber}`.toLowerCase().includes(q)).slice(0, 6);
  }, [students, query]);

  const active = leaves.find((l) => passState(l) !== 'returned');
  const action: 'exit' | 'entry' | null = active ? (passState(active) === 'ready' ? 'exit' : 'entry') : null;

  async function record() {
    if (!student || !action || !code) return;
    setBusy(true);
    try {
      if (action === 'exit') await leavesApi.securityExit(code.trim(), student.studentid);
      else await leavesApi.securityEntry(code.trim(), student.studentid);
      showToast(action === 'exit' ? `${student.firstname} checked out.` : `${student.firstname} checked back in.`, 'success');
      await pick(student);
    } catch (err) {
      showError(err, 'Gate pass could not be verified.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Gate pass check" subtitle="Verify a student's out-pass and log when they leave and return" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>1. Find the student</CardTitle>
            <CardDescription>Search by name or roll number</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. S1001 or Arjun" aria-label="Search student" className="h-10 pl-8" autoFocus />
            </div>
            {matches.length > 0 && (
              <ul className="rounded-md border">
                {matches.map((s) => (
                  <li key={s.studentid}>
                    <button
                      type="button"
                      onClick={() => pick(s)}
                      className="w-full px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <PersonCell name={`${s.firstname} ${s.lastname}`} sub={s.rollnumber} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {student && (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
                <PersonCell name={`${student.firstname} ${student.lastname}`} sub={student.rollnumber} />
                <Button size="sm" variant="ghost" onClick={() => setStudent(null)}>
                  Change
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>2. Scan the gate pass</CardTitle>
            <CardDescription>Use the QR scanner, or type the code shown under the student's QR</CardDescription>
          </CardHeader>
          <CardContent>
            {!student ? (
              <EmptyState title="No student selected" hint="Find the student first." />
            ) : loadingLeaves ? (
              <LoadingState />
            ) : !active ? (
              <EmptyState title="No valid gate pass" hint={`${student.firstname} has no approved leave to leave or return on.`} />
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {active.startdate} → {active.enddate}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        passState(active) === 'out' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800',
                      )}
                    >
                      {PASS_LABEL[passState(active)]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{active.reason}</div>
                  {active.exitlogged && <div className="mt-1 text-xs text-muted-foreground">Left {fmtDateTime(active.exitlogged)}</div>}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    record();
                  }}
                  className="space-y-3"
                >
                  <div className="relative">
                    <ScanLine className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Gate pass code"
                      aria-label="Gate pass code"
                      className="h-10 pl-8 font-mono"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" className="w-full" loading={busy} disabled={!code.trim()}>
                    {action === 'exit' ? (
                      <>
                        <LogOut /> Verify and log exit
                      </>
                    ) : (
                      <>
                        <LogIn /> Verify and log return
                      </>
                    )}
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
