import { useEffect, useMemo, useState } from 'react';
import { AlarmClock, CreditCard, Download, FileSpreadsheet, Receipt, Search, Settings2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { Badge } from '../components/Badge';
import { SelectField, TextField } from '../components/Form';
import { EmptyState } from '../components/Feedback';
import { RowActions } from '../components/RowActions';
import { PersonCell } from '../components/PersonCell';
import { useConfirm } from '../components/ConfirmDialog';
import { feesApi, studentsApi } from '../api/endpoints';
import { downloadFile } from '../api/client';
import type { Fee, Student } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const ROOM_TYPES = ['Non-AC', 'AC', 'Deluxe'];
const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const due = (f: Fee) => Number(f.amountdue);
const paid = (f: Fee) => Number(f.amountpaid);
const balance = (f: Fee) => Math.max(0, due(f) - paid(f));
const isPaid = (f: Fee) => f.paymentstatus.toUpperCase() === 'PAID';

function totals(fees: Fee[]) {
  const billed = fees.reduce((n, f) => n + due(f), 0);
  const collected = fees.reduce((n, f) => n + paid(f), 0);
  const nextDue = fees.filter((f) => !isPaid(f)).sort((a, b) => a.duedate.localeCompare(b.duedate))[0];
  return { billed, collected, outstanding: Math.max(0, billed - collected), nextDue };
}

async function downloadReceipt(fee: Fee, onError: (err: unknown) => void) {
  try {
    await downloadFile(`/reports/receipt/${fee.feeid}.pdf`, `receipt-${fee.feeid}.pdf`);
  } catch (err) {
    onError(err);
  }
}

function SummaryTiles({ fees }: { fees: Fee[] }) {
  const t = totals(fees);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Tile label="Outstanding" value={inr(t.outstanding)} tone={t.outstanding > 0 ? 'text-red-700' : undefined} />
      <Tile label="Paid" value={inr(t.collected)} hint={`of ${inr(t.billed)} billed`} />
      <Tile label="Next due" value={t.nextDue ? t.nextDue.duedate : '—'} hint={t.nextDue ? inr(balance(t.nextDue)) : 'Nothing outstanding'} />
    </div>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-xl font-semibold tracking-tight tabular-nums', tone)}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function FeesPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'Student') return <StudentFeesPage />;
  return <AdminFeesPage />;
}

function AdminFeesPage() {
  const { showToast, showError } = useToast();
  const { confirm, dialog } = useConfirm();
  const [students, setStudents] = useState<Student[]>([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [selected, setSelected] = useState<Student | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(false);

  const [structureModal, setStructureModal] = useState(false);
  const [structure, setStructure] = useState({ roomtype: 'Non-AC', amount: 0, semester: '' });
  const [generateModal, setGenerateModal] = useState(false);
  const [generate, setGenerate] = useState({ semester: '', duedate: '' });
  const [payModal, setPayModal] = useState<Fee | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    studentsApi.list().then(setStudents).catch((err) => showError(err, 'Failed to load students.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFees(s: Student) {
    setSelected(s);
    setLoading(true);
    try {
      setFees(await feesApi.forStudent(s.studentid));
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
      showToast(`Fee for ${structure.roomtype} rooms set to ${inr(structure.amount)} for ${structure.semester}.`, 'success');
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
      const created = await feesApi.generate(generate.semester, generate.duedate);
      showToast(`${created.length} bills generated for ${generate.semester}.`, 'success');
      setGenerateModal(false);
      if (selected) loadFees(selected);
    } catch (err) {
      showError(err, 'Failed to generate dues.');
    } finally {
      setSaving(false);
    }
  }

  async function markOverdue() {
    const ok = await confirm({
      title: 'Mark overdue bills?',
      description: 'Every unpaid bill past its due date will be flagged as overdue.',
      confirmLabel: 'Mark overdue',
    });
    if (!ok) return;
    try {
      await feesApi.markOverdue();
      showToast('Overdue bills flagged.', 'success');
      if (selected) loadFees(selected);
    } catch (err) {
      showError(err, 'Failed to mark overdue fees.');
    }
  }

  async function recordPayment() {
    if (!payModal || !selected) return;
    setSaving(true);
    try {
      await feesApi.pay(payModal.feeid, payAmount);
      showToast(`Payment of ${inr(payAmount)} recorded.`, 'success');
      setPayModal(null);
      loadFees(selected);
    } catch (err) {
      showError(err, 'Payment failed.');
    } finally {
      setSaving(false);
    }
  }

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    return q ? students.filter((s) => `${s.firstname} ${s.lastname} ${s.rollnumber}`.toLowerCase().includes(q)) : students;
  }, [students, studentQuery]);

  const columns: Column<Fee>[] = [
    { key: 'duedate', header: 'Due date', render: (f) => f.duedate, sortValue: (f) => f.duedate },
    { key: 'due', header: 'Billed', align: 'right', render: (f) => inr(due(f)), sortValue: due },
    { key: 'paid', header: 'Paid', align: 'right', render: (f) => inr(paid(f)) },
    { key: 'balance', header: 'Balance', align: 'right', render: (f) => <span className={cn(balance(f) > 0 && 'font-medium')}>{inr(balance(f))}</span> },
    { key: 'status', header: 'Status', render: (f) => <Badge status={f.paymentstatus} /> },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (f) => (
        <RowActions
          label={`Actions for bill due ${f.duedate}`}
          actions={[
            ...(!isPaid(f)
              ? [
                  {
                    label: 'Record payment',
                    icon: CreditCard,
                    onSelect: () => {
                      setPayModal(f);
                      setPayAmount(balance(f));
                    },
                  },
                ]
              : []),
            ...(paid(f) > 0 ? [{ label: 'Download receipt', icon: Download, onSelect: () => downloadReceipt(f, (e) => showError(e, 'Failed to download receipt.')) }] : []),
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fees"
        subtitle="Fee structures, dues and payments"
        actions={
          <>
            <Button variant="secondary" onClick={markOverdue}>
              <AlarmClock /> Mark overdue
            </Button>
            <Button variant="secondary" onClick={() => setStructureModal(true)}>
              <Settings2 /> Fee structure
            </Button>
            <Button onClick={() => setGenerateModal(true)}>
              <FileSpreadsheet /> Generate dues
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>Students</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Search students"
                aria-label="Search students"
                className="h-9 pl-8"
              />
            </div>
            <ul className="-mx-1 max-h-[26rem] space-y-0.5 overflow-y-auto">
              {filteredStudents.map((s) => (
                <li key={s.studentid}>
                  <button
                    type="button"
                    onClick={() => loadFees(s)}
                    aria-current={selected?.studentid === s.studentid || undefined}
                    className={cn(
                      'w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected?.studentid === s.studentid && 'bg-primary/10 hover:bg-primary/10',
                    )}
                  >
                    <PersonCell name={`${s.firstname} ${s.lastname}`} sub={s.rollnumber} />
                  </button>
                </li>
              ))}
              {filteredStudents.length === 0 && <li className="px-2 py-4 text-center text-sm text-muted-foreground">No students match.</li>}
            </ul>
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          {!selected ? (
            <Card>
              <EmptyState title="Select a student" hint="Choose a student on the left to see their bills and record payments." />
            </Card>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-semibold">
                  {selected.firstname} {selected.lastname}
                </h2>
                <p className="text-sm text-muted-foreground">{selected.rollnumber}</p>
              </div>
              {!loading && <SummaryTiles fees={fees} />}
              <Table
                columns={columns}
                rows={fees}
                rowKey={(f) => f.feeid}
                loading={loading}
                emptyMessage="No bills yet"
                emptyHint="Bills appear after dues are generated for this student's room type."
              />
            </>
          )}
        </div>
      </div>

      <Modal
        open={structureModal}
        title="Set fee structure"
        onClose={() => setStructureModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStructureModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveStructure} loading={saving} disabled={!structure.semester || structure.amount <= 0}>
              Save
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-muted-foreground">Set the semester fee for one room category. Generating dues bills each housed student by their room's type.</p>
        <SelectField
          label="Room type"
          value={structure.roomtype}
          onChange={(e) => setStructure({ ...structure, roomtype: e.target.value })}
          options={ROOM_TYPES.map((t) => ({ value: t, label: t }))}
        />
        <div className="grid grid-cols-2 gap-x-4">
          <TextField label="Amount (₹)" type="number" min={0} value={structure.amount} onChange={(e) => setStructure({ ...structure, amount: Number(e.target.value) })} />
          <TextField label="Semester" placeholder="e.g. 2026-1" value={structure.semester} onChange={(e) => setStructure({ ...structure, semester: e.target.value })} />
        </div>
      </Modal>

      <Modal
        open={generateModal}
        title="Generate dues"
        onClose={() => setGenerateModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setGenerateModal(false)}>
              Cancel
            </Button>
            <Button onClick={runGenerate} loading={saving} disabled={!generate.semester || !generate.duedate}>
              Generate bills
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-muted-foreground">Creates a bill for every student with an active room, using the fee structure for that semester.</p>
        <div className="grid grid-cols-2 gap-x-4">
          <TextField label="Semester" placeholder="e.g. 2026-1" value={generate.semester} onChange={(e) => setGenerate({ ...generate, semester: e.target.value })} />
          <TextField label="Due date" type="date" value={generate.duedate} onChange={(e) => setGenerate({ ...generate, duedate: e.target.value })} />
        </div>
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
            <Button onClick={recordPayment} loading={saving} disabled={!payModal || payAmount <= 0 || payAmount > balance(payModal)}>
              Record {inr(payAmount)}
            </Button>
          </>
        }
      >
        {payModal && <p className="mb-4 text-sm text-muted-foreground">Outstanding on this bill: {inr(balance(payModal))}.</p>}
        <TextField label="Amount received (₹)" type="number" min={0} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} />
      </Modal>
      {dialog}
    </div>
  );
}

function StudentFeesPage() {
  const { showToast, showError } = useToast();
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<Fee | null>(null);
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setFees(await feesApi.me());
    } catch (err) {
      showError(err, 'Failed to load your fees.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pay() {
    if (!paying) return;
    setSaving(true);
    try {
      const updated = await feesApi.pay(paying.feeid, amount);
      showToast(`Payment of ${inr(amount)} successful. Reference ${updated.txnreference ?? ''}`.trim(), 'success');
      setPaying(null);
      load();
    } catch (err) {
      showError(err, 'Payment failed.');
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<Fee>[] = [
    { key: 'duedate', header: 'Due date', render: (f) => f.duedate, sortValue: (f) => f.duedate },
    { key: 'due', header: 'Billed', align: 'right', render: (f) => inr(due(f)) },
    { key: 'paid', header: 'Paid', align: 'right', render: (f) => inr(paid(f)) },
    { key: 'status', header: 'Status', render: (f) => <Badge status={f.paymentstatus} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (f) => (
        <div className="flex justify-end gap-2">
          {paid(f) > 0 && (
            <Button size="sm" variant="ghost" onClick={() => downloadReceipt(f, (e) => showError(e, 'Failed to download receipt.'))}>
              <Receipt /> Receipt
            </Button>
          )}
          {!isPaid(f) && (
            <Button
              size="sm"
              onClick={() => {
                setPaying(f);
                setAmount(balance(f));
              }}
            >
              Pay {inr(balance(f))}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="My fees" subtitle="Hostel bills, payments and receipts" />
      {!loading && fees.length > 0 && <SummaryTiles fees={fees} />}
      <Table
        columns={columns}
        rows={fees}
        rowKey={(f) => f.feeid}
        loading={loading}
        emptyMessage="No bills yet"
        emptyHint="Your hostel bills will appear here once they are generated."
      />

      <Modal
        open={!!paying}
        title="Pay hostel fee"
        onClose={() => setPaying(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPaying(null)}>
              Cancel
            </Button>
            <Button onClick={pay} loading={saving} disabled={!paying || amount <= 0 || amount > balance(paying)}>
              <CreditCard /> Pay {inr(amount)}
            </Button>
          </>
        }
      >
        {paying && (
          <div className="mb-4 rounded-lg border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bill due</span>
              <span>{paying.duedate}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">Outstanding</span>
              <span className="font-medium tabular-nums">{inr(balance(paying))}</span>
            </div>
          </div>
        )}
        <TextField label="Amount to pay (₹)" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        <p className="text-xs text-muted-foreground">This demo uses a simulated payment gateway; no real money is charged.</p>
      </Modal>
    </div>
  );
}
