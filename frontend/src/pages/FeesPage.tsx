import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { Badge } from '../components/Badge';
import { SelectField, TextField } from '../components/Form';
import { feesApi, studentsApi } from '../api/endpoints';
import { downloadFile } from '../api/client';
import type { Fee, Student } from '../types';

export function FeesPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'Student') return <StudentFeesPage />;
  return <AdminFeesPage />;
}

function AdminFeesPage() {
  const { showToast, showError } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<number>(0);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(false);

  const [structureModal, setStructureModal] = useState(false);
  const [structure, setStructure] = useState({ roomtype: 'Double', amount: 0, semester: '' });
  const [generateModal, setGenerateModal] = useState(false);
  const [generate, setGenerate] = useState({ semester: '', duedate: '' });
  const [payModal, setPayModal] = useState<Fee | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    studentsApi.list().then(setStudents).catch((err) => showError(err, 'Failed to load students.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFees(studentid: number) {
    setSelectedStudent(studentid);
    if (!studentid) {
      setFees([]);
      return;
    }
    setLoading(true);
    try {
      setFees(await feesApi.forStudent(studentid));
    } catch (err) {
      showError(err, 'Failed to load fees.');
    } finally {
      setLoading(false);
    }
  }

  async function saveStructure() {
    setSaving(true);
    try {
      await feesApi.setStructure(structure.roomtype, structure.amount, structure.semester);
      showToast('Fee structure saved.', 'success');
      setStructureModal(false);
    } catch (err) {
      showError(err, 'Failed to save fee structure.');
    } finally {
      setSaving(false);
    }
  }

  async function runGenerate() {
    setSaving(true);
    try {
      await feesApi.generate(generate.semester, generate.duedate);
      showToast('Dues generated for all active students.', 'success');
      setGenerateModal(false);
      if (selectedStudent) loadFees(selectedStudent);
    } catch (err) {
      showError(err, 'Failed to generate dues.');
    } finally {
      setSaving(false);
    }
  }

  async function markOverdue() {
    try {
      await feesApi.markOverdue();
      showToast('Overdue fees flagged.', 'success');
      if (selectedStudent) loadFees(selectedStudent);
    } catch (err) {
      showError(err, 'Failed to mark overdue fees.');
    }
  }

  async function recordPayment() {
    if (!payModal) return;
    setSaving(true);
    try {
      await feesApi.pay(payModal.feeid, payAmount);
      showToast('Payment recorded.', 'success');
      setPayModal(null);
      loadFees(selectedStudent);
    } catch (err) {
      showError(err, 'Payment failed.');
    } finally {
      setSaving(false);
    }
  }

  async function receipt(fee: Fee) {
    try {
      await downloadFile(`/reports/receipt/${fee.feeid}.pdf`, `receipt-${fee.feeid}.pdf`);
    } catch (err) {
      showError(err, 'Failed to download receipt.');
    }
  }

  const columns: Column<Fee>[] = [
    { key: 'due', header: 'Amount due', render: (f) => `₹${f.amountdue}` },
    { key: 'paid', header: 'Amount paid', render: (f) => `₹${f.amountpaid}` },
    { key: 'duedate', header: 'Due date', render: (f) => f.duedate, sortValue: (f) => f.duedate },
    { key: 'status', header: 'Status', render: (f) => <Badge status={f.paymentstatus} /> },
    {
      key: 'actions',
      header: '',
      render: (f) => (
        <div className="flex gap-2">
          {f.paymentstatus.toUpperCase() !== 'PAID' && (
            <Button
              size="sm"
              onClick={() => {
                setPayModal(f);
                setPayAmount(f.amountdue - f.amountpaid);
              }}
            >
              Record payment
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => receipt(f)}>
            Receipt
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Fees"
        subtitle="Fee structures, dues, and payments"
        actions={
          <>
            <Button variant="secondary" onClick={markOverdue}>
              Mark overdue
            </Button>
            <Button variant="secondary" onClick={() => setGenerateModal(true)}>
              Generate dues
            </Button>
            <Button onClick={() => setStructureModal(true)}>Set fee structure</Button>
          </>
        }
      />

      <Card title="Look up student fees">
        <SelectField
          label="Student"
          value={selectedStudent}
          onChange={(e) => loadFees(Number(e.target.value))}
          placeholder="Select a student"
          options={students.map((s) => ({ value: s.studentid, label: `${s.firstname} ${s.lastname} (${s.rollnumber})` }))}
        />
        {selectedStudent > 0 && <Table columns={columns} rows={fees} rowKey={(f) => f.feeid} loading={loading} />}
      </Card>

      <Modal
        open={structureModal}
        title="Set fee structure"
        onClose={() => setStructureModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStructureModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveStructure} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        <SelectField
          label="Room type"
          value={structure.roomtype}
          onChange={(e) => setStructure({ ...structure, roomtype: e.target.value })}
          options={[
            { value: 'Single', label: 'Single' },
            { value: 'Double', label: 'Double' },
            { value: 'Triple', label: 'Triple' },
            { value: 'Dormitory', label: 'Dormitory' },
          ]}
        />
        <TextField label="Amount" type="number" value={structure.amount} onChange={(e) => setStructure({ ...structure, amount: Number(e.target.value) })} />
        <TextField label="Semester" placeholder="e.g. 2026-1" value={structure.semester} onChange={(e) => setStructure({ ...structure, semester: e.target.value })} />
      </Modal>

      <Modal
        open={generateModal}
        title="Generate dues for all active students"
        onClose={() => setGenerateModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setGenerateModal(false)}>
              Cancel
            </Button>
            <Button onClick={runGenerate} loading={saving}>
              Generate
            </Button>
          </>
        }
      >
        <TextField label="Semester" placeholder="e.g. 2026-1" value={generate.semester} onChange={(e) => setGenerate({ ...generate, semester: e.target.value })} />
        <TextField label="Due date" type="date" value={generate.duedate} onChange={(e) => setGenerate({ ...generate, duedate: e.target.value })} />
      </Modal>

      <Modal
        open={!!payModal}
        title="Record payment"
        onClose={() => setPayModal(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPayModal(null)}>
              Cancel
            </Button>
            <Button onClick={recordPayment} loading={saving}>
              Record
            </Button>
          </>
        }
      >
        <p className="mb-3 text-xs text-neutral-500">This simulates a payment gateway callback.</p>
        <TextField label="Amount" type="number" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} />
      </Modal>
    </div>
  );
}

function StudentFeesPage() {
  const { showError } = useToast();
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    feesApi
      .me()
      .then(setFees)
      .catch((err) => showError(err, 'Failed to load your fees.'))
      .finally(() => setLoading(false));
  }, [showError]);

  async function receipt(fee: Fee) {
    try {
      await downloadFile(`/reports/receipt/${fee.feeid}.pdf`, `receipt-${fee.feeid}.pdf`);
    } catch (err) {
      showError(err, 'Failed to download receipt.');
    }
  }

  const columns: Column<Fee>[] = [
    { key: 'due', header: 'Amount due', render: (f) => `₹${f.amountdue}` },
    { key: 'paid', header: 'Amount paid', render: (f) => `₹${f.amountpaid}` },
    { key: 'duedate', header: 'Due date', render: (f) => f.duedate, sortValue: (f) => f.duedate },
    { key: 'status', header: 'Status', render: (f) => <Badge status={f.paymentstatus} /> },
    {
      key: 'actions',
      header: '',
      render: (f) => (
        <Button size="sm" variant="secondary" onClick={() => receipt(f)}>
          Download receipt
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="My Fees" />
      <Card>
        <Table columns={columns} rows={fees} rowKey={(f) => f.feeid} loading={loading} emptyMessage="No fees on record." />
      </Card>
    </div>
  );
}
