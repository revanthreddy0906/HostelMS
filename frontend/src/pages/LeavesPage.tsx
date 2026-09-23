import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { LoadingState } from '../components/Feedback';
import { Badge } from '../components/Badge';
import { TextField, TextareaField } from '../components/Form';
import { leavesApi, studentsApi } from '../api/endpoints';
import { fetchBlob } from '../api/client';
import type { Leave, Student } from '../types';

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
    <div className="flex flex-col items-center gap-2">
      <img src={url} alt={`Gate pass QR for leave ${leaveid}`} className="h-40 w-40 rounded-lg border border-neutral-200" />
      <a href={url} download={`gatepass-${leaveid}.png`} className="text-xs font-medium text-primary-600 hover:underline">
        Download QR
      </a>
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
      showToast('Leave application submitted.', 'success');
      setApplyModal(false);
      setForm({ startdate: '', enddate: '', reason: '' });
      load();
    } catch (err) {
      showError(err, 'Failed to submit leave application.');
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<Leave>[] = [
    { key: 'dates', header: 'Dates', render: (l) => `${l.startdate} → ${l.enddate}` },
    { key: 'reason', header: 'Reason', render: (l) => <span className="line-clamp-2 max-w-xs">{l.reason}</span> },
    { key: 'status', header: 'Status', render: (l) => <Badge status={l.status} /> },
    { key: 'exit', header: 'Exit logged', render: (l) => (l.exitlogged ? new Date(l.exitlogged).toLocaleString() : '—') },
    { key: 'entry', header: 'Entry logged', render: (l) => (l.entrylogged ? new Date(l.entrylogged).toLocaleString() : '—') },
    {
      key: 'gatepass',
      header: '',
      render: (l) =>
        l.status.toUpperCase() === 'APPROVED' && l.gatepasscode ? (
          <Button size="sm" variant="secondary" onClick={() => setQrLeave(l)}>
            Gate pass QR
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader title="My Leaves" actions={<Button onClick={() => setApplyModal(true)}>+ Apply for leave</Button>} />
      <Card>
        <Table columns={columns} rows={leaves} rowKey={(l) => l.leaveid} loading={loading} />
      </Card>

      <Modal
        open={applyModal}
        title="Apply for leave"
        onClose={() => setApplyModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setApplyModal(false)}>
              Cancel
            </Button>
            <Button onClick={apply} loading={saving} disabled={!form.startdate || !form.enddate || !form.reason}>
              Submit
            </Button>
          </>
        }
      >
        <TextField label="Start date" type="date" value={form.startdate} onChange={(e) => setForm({ ...form, startdate: e.target.value })} />
        <TextField label="End date" type="date" value={form.enddate} onChange={(e) => setForm({ ...form, enddate: e.target.value })} />
        <TextareaField label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      </Modal>

      <Modal open={!!qrLeave} title="Gate pass QR code" onClose={() => setQrLeave(null)}>
        {qrLeave && (
          <div>
            <p className="mb-3 text-xs text-neutral-500">
              Code: <span className="font-mono font-semibold">{qrLeave.gatepasscode}</span>. Present this at the gate for exit/entry scanning.
            </p>
            <GatePassImage leaveid={qrLeave.leaveid} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function ApprovalLeavesPage() {
  const { showToast, showError } = useToast();
  const [pending, setPending] = useState<Leave[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

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

  function studentLabel(id: number) {
    const s = students.find((x) => x.studentid === id);
    return s ? `${s.firstname} ${s.lastname} (${s.rollnumber})` : `#${id}`;
  }

  async function decide(l: Leave, approve: boolean) {
    try {
      await leavesApi.decide(l.leaveid, approve);
      showToast(`Leave ${approve ? 'approved' : 'rejected'}.`, 'success');
      load();
    } catch (err) {
      showError(err, 'Failed to record decision.');
    }
  }

  const columns: Column<Leave>[] = [
    { key: 'student', header: 'Student', render: (l) => studentLabel(l.studentid) },
    { key: 'dates', header: 'Dates', render: (l) => `${l.startdate} → ${l.enddate}` },
    { key: 'reason', header: 'Reason', render: (l) => <span className="line-clamp-2 max-w-xs">{l.reason}</span> },
    { key: 'status', header: 'Status', render: (l) => <Badge status={l.status} /> },
    {
      key: 'actions',
      header: '',
      render: (l) => (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => decide(l, true)}>
            Approve
          </Button>
          <Button size="sm" variant="danger" onClick={() => decide(l, false)}>
            Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Leave Approvals" subtitle={`${pending.length} pending requests`} />
      <Card>
        <Table columns={columns} rows={pending} rowKey={(l) => l.leaveid} loading={loading} emptyMessage="No pending leave requests." />
      </Card>
    </div>
  );
}

function SecurityScanPage() {
  const { showToast, showError } = useToast();
  const [gatepassCode, setGatepassCode] = useState('');
  const [studentid, setStudentid] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);

  async function scan(kind: 'exit' | 'entry') {
    if (!gatepassCode || !studentid) return;
    setBusy(true);
    try {
      if (kind === 'exit') await leavesApi.securityExit(gatepassCode, Number(studentid));
      else await leavesApi.securityEntry(gatepassCode, Number(studentid));
      showToast(`Gate pass ${kind} recorded.`, 'success');
      setGatepassCode('');
      setStudentid('');
    } catch (err) {
      showError(err, `Failed to record ${kind}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Security Gate Scan" subtitle="Scan gate-pass code to log student exit or entry" />
      <Card className="max-w-md">
        <TextField
          label="Gate pass code"
          placeholder="Scan or type the code"
          value={gatepassCode}
          onChange={(e) => setGatepassCode(e.target.value)}
        />
        <TextField
          label="Student ID"
          type="number"
          value={studentid}
          onChange={(e) => setStudentid(e.target.value ? Number(e.target.value) : '')}
        />
        <div className="mt-2 flex gap-2">
          <Button onClick={() => scan('exit')} loading={busy} disabled={!gatepassCode || !studentid}>
            Log exit
          </Button>
          <Button variant="secondary" onClick={() => scan('entry')} loading={busy} disabled={!gatepassCode || !studentid}>
            Log entry
          </Button>
        </div>
      </Card>
    </div>
  );
}
