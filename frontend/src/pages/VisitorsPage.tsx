import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { Badge } from '../components/Badge';
import { SelectField, TextField } from '../components/Form';
import { studentsApi, visitorsApi } from '../api/endpoints';
import type { SecurityDashboardRow, Student } from '../types';

export function VisitorsPage() {
  const { showToast, showError } = useToast();
  const [rows, setRows] = useState<SecurityDashboardRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [logModal, setLogModal] = useState(false);
  const [form, setForm] = useState({ visitorname: '', studentid: 0, relationship: '', contactnumber: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
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

  function studentLabel(id: number) {
    const s = students.find((x) => x.studentid === id);
    return s ? `${s.firstname} ${s.lastname} (${s.rollnumber})` : `#${id}`;
  }

  async function logEntry() {
    setSaving(true);
    try {
      await visitorsApi.logEntry(form.visitorname, form.studentid, form.relationship, form.contactnumber || undefined);
      showToast('Visitor logged in.', 'success');
      setLogModal(false);
      setForm({ visitorname: '', studentid: 0, relationship: '', contactnumber: '' });
      load();
    } catch (err) {
      showError(err, 'Failed to log visitor entry.');
    } finally {
      setSaving(false);
    }
  }

  async function logExit(visitorid: number) {
    try {
      await visitorsApi.logExit(visitorid);
      showToast('Visitor exit logged.', 'success');
      load();
    } catch (err) {
      showError(err, 'Failed to log visitor exit.');
    }
  }

  const columns: Column<SecurityDashboardRow>[] = [
    { key: 'name', header: 'Visitor', render: (r) => r.visitorname },
    { key: 'student', header: 'Visiting', render: (r) => studentLabel(r.studentid) },
    { key: 'in', header: 'Check-in', render: (r) => new Date(r.intime).toLocaleString(), sortValue: (r) => r.intime },
    { key: 'hours', header: 'Hours in', render: (r) => r.hours_in.toFixed(1) },
    { key: 'status', header: 'Status', render: (r) => (r.overstaying ? <Badge status="OVERSTAYING" /> : <Badge status="ON PREMISES" />) },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <Button size="sm" variant="secondary" onClick={() => logExit(r.visitorid)}>
          Log exit
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Visitors"
        subtitle="Current visitor log — overstaying visitors are highlighted"
        actions={<Button onClick={() => setLogModal(true)}>+ Log entry</Button>}
      />
      <Card>
        <Table columns={columns} rows={rows} rowKey={(r) => r.visitorid} loading={loading} emptyMessage="No visitors currently on premises." />
      </Card>

      <Modal
        open={logModal}
        title="Log visitor entry"
        onClose={() => setLogModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLogModal(false)}>
              Cancel
            </Button>
            <Button onClick={logEntry} loading={saving} disabled={!form.visitorname || !form.studentid || !form.relationship}>
              Log entry
            </Button>
          </>
        }
      >
        <TextField label="Visitor name" value={form.visitorname} onChange={(e) => setForm({ ...form, visitorname: e.target.value })} />
        <SelectField
          label="Visiting student"
          value={form.studentid}
          onChange={(e) => setForm({ ...form, studentid: Number(e.target.value) })}
          placeholder="Select student"
          options={students.map((s) => ({ value: s.studentid, label: `${s.firstname} ${s.lastname} (${s.rollnumber})` }))}
        />
        <TextField label="Relationship" placeholder="e.g. Parent, Friend" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
        <TextField label="Contact number (optional)" value={form.contactnumber} onChange={(e) => setForm({ ...form, contactnumber: e.target.value })} />
      </Modal>
    </div>
  );
}
