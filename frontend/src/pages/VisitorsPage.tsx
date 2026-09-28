import { useEffect, useMemo, useState } from 'react';
import { Clock, LogOut, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { Badge } from '../components/Badge';
import { SelectField, TextField } from '../components/Form';
import { PersonCell } from '../components/PersonCell';
import { studentsApi, visitorsApi } from '../api/endpoints';
import type { SecurityDashboardRow, Student } from '../types';
import { StatCard } from '../components/Card';
import { cn } from '@/lib/utils';
import { serverTime } from '@/lib/time';

const RELATIONSHIPS = ['Parent', 'Guardian', 'Sibling', 'Relative', 'Friend', 'Other'];
const emptyForm = { visitorname: '', studentid: 0, relationship: 'Parent', contactnumber: '' };

function formatDuration(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function VisitorsPage() {
  const { user } = useAuth();
  const canLog = user?.role === 'Staff' || user?.role === 'Admin';
  const { showToast, showError } = useToast();
  const [rows, setRows] = useState<SecurityDashboardRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [logModal, setLogModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [exiting, setExiting] = useState<number | null>(null);

  async function load() {
    try {
      const [d, s] = await Promise.all([visitorsApi.dashboard(), studentsApi.list()]);
      setRows(d);
      setStudents(s);
    } catch (err) {
      showError(err, 'Failed to load visitors.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const studentById = useMemo(() => new Map(students.map((s) => [s.studentid, s])), [students]);
  const hostName = (id: number) => {
    const s = studentById.get(id);
    return s ? `${s.firstname} ${s.lastname}` : `Student #${id}`;
  };

  async function logEntry() {
    setSaving(true);
    try {
      await visitorsApi.logEntry(form.visitorname.trim(), form.studentid, form.relationship, form.contactnumber || undefined);
      showToast(`${form.visitorname} checked in to visit ${hostName(form.studentid)}.`, 'success');
      setLogModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      showError(err, 'Failed to log visitor entry.');
    } finally {
      setSaving(false);
    }
  }

  async function logExit(r: SecurityDashboardRow) {
    setExiting(r.visitorid);
    try {
      await visitorsApi.logExit(r.visitorid);
      showToast(`${r.visitorname} checked out.`, 'success');
      setRows((prev) => prev.filter((x) => x.visitorid !== r.visitorid));
    } catch (err) {
      showError(err, 'Failed to log visitor exit.');
    } finally {
      setExiting(null);
    }
  }

  const overstaying = rows.filter((r) => r.overstaying).length;
  const sorted = [...rows].sort((a, b) => Number(b.overstaying) - Number(a.overstaying) || b.hours_in - a.hours_in);

  const columns: Column<SecurityDashboardRow>[] = [
    { key: 'name', header: 'Visitor', render: (r) => <PersonCell name={r.visitorname} />, sortValue: (r) => r.visitorname },
    {
      key: 'student',
      header: 'Visiting',
      render: (r) => (
        <div>
          <div>{hostName(r.studentid)}</div>
          <div className="text-xs text-muted-foreground">{studentById.get(r.studentid)?.rollnumber}</div>
        </div>
      ),
    },
    {
      key: 'in',
      header: 'Checked in',
      sortValue: (r) => r.intime,
      render: (r) => serverTime(r.intime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    },
    {
      key: 'hours',
      header: 'Time inside',
      align: 'right',
      sortValue: (r) => r.hours_in,
      render: (r) => <span className={cn(r.overstaying && 'font-medium text-red-700')}>{formatDuration(r.hours_in)}</span>,
    },
    { key: 'status', header: 'Status', render: (r) => <Badge status={r.overstaying ? 'OVERSTAYING' : 'ON PREMISES'} /> },
    ...(canLog
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (r: SecurityDashboardRow) => (
              <Button size="sm" variant={r.overstaying ? 'primary' : 'secondary'} loading={exiting === r.visitorid} onClick={() => logExit(r)}>
                <LogOut /> Check out
              </Button>
            ),
          } as Column<SecurityDashboardRow>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visitors"
        subtitle="Everyone currently on premises; overstays are flagged automatically"
        actions={
          canLog ? (
            <Button onClick={() => setLogModal(true)}>
              <Plus /> Check in visitor
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="On premises" value={loading ? '…' : rows.length} tone="info" />
        <StatCard label="Overstaying" value={loading ? '…' : overstaying} tone={overstaying ? 'danger' : 'success'} hint="Past the maximum visiting hours" />
      </div>

      <Table
        columns={columns}
        rows={sorted}
        rowKey={(r) => r.visitorid}
        loading={loading}
        emptyMessage="No visitors on premises"
        emptyHint={canLog ? 'Check a visitor in when they arrive at the gate.' : undefined}
        searchText={(r) => `${r.visitorname} ${hostName(r.studentid)} ${studentById.get(r.studentid)?.rollnumber ?? ''}`}
        searchPlaceholder="Search visitors or students"
      />

      <Modal
        open={logModal}
        title="Check in a visitor"
        onClose={() => setLogModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLogModal(false)}>
              Cancel
            </Button>
            <Button onClick={logEntry} loading={saving} disabled={!form.visitorname.trim() || !form.studentid || !form.relationship}>
              Check in
            </Button>
          </>
        }
      >
        <TextField label="Visitor name" value={form.visitorname} onChange={(e) => setForm({ ...form, visitorname: e.target.value })} />
        <div className="grid grid-cols-2 gap-x-4">
          <TextField label="Contact number" type="tel" value={form.contactnumber} onChange={(e) => setForm({ ...form, contactnumber: e.target.value })} />
          <SelectField
            label="Relationship"
            value={form.relationship}
            onChange={(e) => setForm({ ...form, relationship: e.target.value })}
            options={RELATIONSHIPS.map((r) => ({ value: r, label: r }))}
          />
        </div>
        <SelectField
          label="Visiting student"
          value={form.studentid}
          onChange={(e) => setForm({ ...form, studentid: Number(e.target.value) })}
          placeholder="Select student"
          options={students.map((s) => ({ value: s.studentid, label: `${s.firstname} ${s.lastname} (${s.rollnumber})` }))}
        />
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden="true" />
          Entry time is recorded automatically. Visitors past the maximum visiting hours are flagged as overstaying.
        </p>
      </Modal>
    </div>
  );
}
