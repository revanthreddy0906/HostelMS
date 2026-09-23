import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { EmptyState } from '../components/Feedback';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table, type Column } from '../components/Table';
import { Badge } from '../components/Badge';
import { SelectField, TextField } from '../components/Form';
import { attendanceApi, studentsApi } from '../api/endpoints';
import type { AbsenteeAlert, Attendance, Student } from '../types';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_OPTIONS = ['Present', 'Absent', 'On Leave'];

export function AttendancePage() {
  const { showToast, showError } = useToast();
  const [date, setDate] = useState(today());
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [alerts, setAlerts] = useState<AbsenteeAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [markStudent, setMarkStudent] = useState(0);
  const [markStatus, setMarkStatus] = useState('Present');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [s, r, a] = await Promise.all([studentsApi.list(), attendanceApi.forDate(date), attendanceApi.alerts()]);
      setStudents(s);
      setRecords(r);
      setAlerts(a);
    } catch (err) {
      showError(err, 'Failed to load attendance.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function studentLabel(id: number) {
    const s = students.find((x) => x.studentid === id);
    return s ? `${s.firstname} ${s.lastname} (${s.rollnumber})` : `#${id}`;
  }

  async function mark() {
    setSaving(true);
    try {
      await attendanceApi.mark(markStudent, date, markStatus);
      showToast('Attendance marked.', 'success');
      setMarkStudent(0);
      load();
    } catch (err) {
      showError(err, 'Failed to mark attendance.');
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<Attendance>[] = [
    { key: 'student', header: 'Student', render: (a) => studentLabel(a.studentid) },
    { key: 'status', header: 'Status', render: (a) => <Badge status={a.status} /> },
    { key: 'markedby', header: 'Marked by (userid)', render: (a) => a.markedby },
  ];

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Daily marking and absence alerts" />

      <Card title="Mark attendance">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
          <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <SelectField
            label="Student"
            value={markStudent}
            onChange={(e) => setMarkStudent(Number(e.target.value))}
            placeholder="Select student"
            options={students.map((s) => ({ value: s.studentid, label: `${s.firstname} ${s.lastname} (${s.rollnumber})` }))}
          />
          <SelectField
            label="Status"
            value={markStatus}
            onChange={(e) => setMarkStatus(e.target.value)}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
          />
          <Button onClick={mark} loading={saving} disabled={!markStudent}>
            Mark
          </Button>
        </div>
      </Card>

      <Card title={`Attendance for ${date}`} className="mt-6">
        <Table columns={columns} rows={records} rowKey={(a) => a.attendanceid} loading={loading} />
      </Card>

      <Card title="Consecutive-absence alerts" className="mt-6">
        {alerts.length === 0 ? (
          <EmptyState title="No attendance alerts" hint="No students with concerning absence patterns." />
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {alerts.map((a) => (
              <li key={a.studentid} className="flex items-center justify-between py-2.5">
                <span>{a.name} ({a.rollnumber})</span>
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
