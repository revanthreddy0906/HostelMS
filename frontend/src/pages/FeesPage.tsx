import { useEffect, useMemo, useState } from 'react';
import { AlarmClock, CalendarPlus, CreditCard, Download, Receipt, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { Badge } from '../components/Badge';
import { TextField } from '../components/Form';
import { EmptyState, LoadingState } from '../components/Feedback';
import { RowActions } from '../components/RowActions';
import { PersonCell } from '../components/PersonCell';
import { useConfirm } from '../components/ConfirmDialog';
import { inr } from '../components/FloorMap';
import { feesApi, settingsApi, studentsApi } from '../api/endpoints';
import { downloadFile } from '../api/client';
import type { Fee, FinanceSummary, Payment, SettingsValues, Student } from '../types';
import { serverTime } from '@/lib/time';
import { billLabel, periodLabel } from '@/lib/fees';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const isPaid = (f: Fee) => f.paymentstatus.toUpperCase() === 'PAID';

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function downloadReceipt(fee: Fee, onError: (err: unknown) => void) {
  try {
    await downloadFile(`/reports/receipt/${fee.feeid}.pdf`, `receipt-${fee.feeid}.pdf`);
  } catch (err) {
    onError(err);
  }
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

function StudentTiles({ fees }: { fees: Fee[] }) {
  const open = fees.filter((f) => !isPaid(f) && f.billtype !== 'Deposit');
  const dues = open.reduce((n, f) => n + f.balance, 0);
  const fines = open.reduce((n, f) => n + f.latefine, 0);
  const deposit = fees.find((f) => f.billtype === 'Deposit');
  const next = [...open].sort((a, b) => a.duedate.localeCompare(b.duedate))[0];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tile label="Current dues" value={inr(dues)} tone={dues > 0 ? 'text-red-700' : undefined} hint={open.length ? `${open.length} unpaid bills` : 'All paid'} />
      <Tile label="Late fine" value={inr(fines)} tone={fines > 0 ? 'text-red-700' : undefined} hint={fines > 0 ? 'Keeps growing until paid' : 'No late fines'} />
      <Tile
        label="Security deposit"
        value={deposit ? inr(deposit.amountdue) : '—'}
        hint={deposit ? (isPaid(deposit) ? 'Held, refundable on vacating' : `${inr(deposit.balance)} still to pay`) : 'Not raised yet'}
      />
      <Tile label="Next due" value={next ? next.duedate : '—'} hint={next ? billLabel(next) : 'Nothing outstanding'} />
    </div>
  );
}

function PaymentHistory({ payments, fees }: { payments: Payment[]; fees: Fee[] }) {
  const feeById = new Map(fees.map((f) => [f.feeid, f]));
  const columns: Column<Payment>[] = [
    {
      key: 'date',
      header: 'Date',
      sortValue: (p) => p.paidat,
      render: (p) => serverTime(p.paidat).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    },
    { key: 'bill', header: 'For', render: (p) => (feeById.get(p.feeid) ? billLabel(feeById.get(p.feeid)!) : `Bill #${p.feeid}`) },
    { key: 'method', header: 'Method', render: (p) => (p.method === 'Settlement' ? 'From deposit' : p.method) },
    { key: 'ref', header: 'Reference', render: (p) => <span className="font-mono text-xs">{p.txnreference ?? '—'}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: (p) => inr(p.amount), sortValue: (p) => p.amount },
  ];
  return <Table columns={columns} rows={payments} rowKey={(p) => p.paymentid} emptyMessage="No payments yet" pageSize={8} />;
}

function billColumns(extra: Column<Fee>): Column<Fee>[] {
  return [
    {
      key: 'bill',
      header: 'Bill',
      sortValue: (f) => f.duedate,
      render: (f) => (
        <div>
          <div className="font-medium">{billLabel(f)}</div>
          <div className="text-xs text-muted-foreground">Due {f.duedate}</div>
        </div>
      ),
    },
    { key: 'amount', header: 'Amount', align: 'right', render: (f) => inr(f.amountdue) },
    {
      key: 'fine',
      header: 'Late fine',
      align: 'right',
      render: (f) =>
        f.latefine > 0 ? (
          <span className={cn(!isPaid(f) && 'font-medium text-red-700')} title={f.latedays ? `${f.latedays} days late` : 'Fixed when paid'}>
            {inr(f.latefine)}
            {!isPaid(f) && f.latedays ? <span className="block text-[11px] font-normal">{f.latedays} days</span> : null}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { key: 'paid', header: 'Paid', align: 'right', render: (f) => inr(f.amountpaid) },
    { key: 'balance', header: 'Balance', align: 'right', render: (f) => <span className={cn(f.balance > 0 && 'font-medium')}>{inr(f.balance)}</span> },
    { key: 'status', header: 'Status', render: (f) => <Badge status={f.paymentstatus} /> },
    extra,
  ];
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
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [settings, setSettings] = useState<SettingsValues>({});
  const [studentQuery, setStudentQuery] = useState('');
  const [selected, setSelected] = useState<Student | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [period, setPeriod] = useState(currentPeriod());
  const [payModal, setPayModal] = useState<Fee | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [saving, setSaving] = useState(false);

  async function loadSummary() {
    try {
      setSummary(await feesApi.summary());
    } catch (err) {
      showError(err, 'Failed to load the finance summary.');
    }
  }

  useEffect(() => {
    studentsApi.list().then(setStudents).catch((err) => showError(err, 'Failed to load students.'));
    settingsApi.get().then((r) => setSettings(r.values)).catch(() => undefined);
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFees(s: Student) {
    setSelected(s);
    setLoading(true);
    try {
      const [f, p] = await Promise.all([feesApi.forStudent(s.studentid), feesApi.paymentsForStudent(s.studentid)]);
      setFees(f);
      setPayments(p);
    } catch (err) {
      showError(err, 'Failed to load fees.');
    } finally {
      setLoading(false);
    }
  }

  async function runGenerate() {
    setSaving(true);
    try {
      const created = await feesApi.generateRent(period);
      showToast(created.length ? `${created.length} rent bills raised for ${periodLabel(period)}.` : `Rent for ${periodLabel(period)} was already billed.`, 'success');
      setGenerateOpen(false);
      loadSummary();
      if (selected) loadFees(selected);
    } catch (err) {
      showError(err, 'Failed to generate rent.');
    } finally {
      setSaving(false);
    }
  }

  async function markOverdue() {
    const ok = await confirm({
      title: 'Mark overdue bills?',
      description: 'Every unpaid bill past its due date will be flagged as overdue. Late fines accrue automatically either way.',
      confirmLabel: 'Mark overdue',
    });
    if (!ok) return;
    try {
      const r = await feesApi.markOverdue();
      showToast(`${r.marked_overdue} bills flagged as overdue.`, 'success');
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
      showToast(`Cash payment of ${inr(payAmount)} recorded.`, 'success');
      setPayModal(null);
      loadFees(selected);
      loadSummary();
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

  const columns = billColumns({
    key: 'actions',
    header: '',
    className: 'w-12',
    render: (f) => (
      <RowActions
        label={`Actions for ${billLabel(f)}`}
        actions={[
          ...(!isPaid(f)
            ? [
                {
                  label: 'Record cash payment',
                  icon: CreditCard,
                  onSelect: () => {
                    setPayModal(f);
                    setPayAmount(f.balance);
                  },
                },
              ]
            : []),
          ...(f.amountpaid > 0 ? [{ label: 'Download receipt', icon: Download, onSelect: () => downloadReceipt(f, (e) => showError(e, 'Failed to download receipt.')) }] : []),
        ]}
      />
    ),
  });

  const o = summary?.outstanding;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fees"
        subtitle={`Rent due by day ${settings.rent_due_day ?? 3} · ${inr(Number(settings.late_fine_per_day ?? 50))}/day late fine · ${inr(Number(settings.security_deposit ?? 3000))} deposit`}
        actions={
          <>
            <Button variant="secondary" onClick={markOverdue}>
              <AlarmClock /> Mark overdue
            </Button>
            <Button onClick={() => setGenerateOpen(true)}>
              <CalendarPlus /> Generate rent
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Rent outstanding" value={o ? inr(o.Rent) : '…'} hint={summary ? `${summary.overdue_bills} bills overdue` : undefined} />
        <Tile label="Late fines accrued" value={o ? inr(o.fines) : '…'} tone={o && o.fines > 0 ? 'text-red-700' : undefined} />
        <Tile label="AC and deposits due" value={o ? inr(o.AC + o.Deposit) : '…'} hint={o ? `AC ${inr(o.AC)} · deposits ${inr(o.Deposit)}` : undefined} />
        <Tile label="Collected this month" value={summary ? inr(summary.collected_this_month) : '…'} tone="text-emerald-700" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>Students</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder="Search students" aria-label="Search students" className="h-9 pl-8" />
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
              <EmptyState title="Select a student" hint="Choose a student to see their rent, deposit and AC bills, fines and payment history." />
            </Card>
          ) : loading ? (
            <LoadingState />
          ) : (
            <>
              <div>
                <h2 className="text-lg font-semibold">
                  {selected.firstname} {selected.lastname}
                </h2>
                <p className="text-sm text-muted-foreground">{selected.rollnumber}</p>
              </div>
              <StudentTiles fees={fees} />
              <Table columns={columns} rows={fees} rowKey={(f) => f.feeid} emptyMessage="No bills yet" emptyHint="Rent bills appear after rent is generated for a month." />
              <h3 className="pt-2 text-sm font-medium text-muted-foreground">Payment history</h3>
              <PaymentHistory payments={payments} fees={fees} />
            </>
          )}
        </div>
      </div>

      <Modal
        open={generateOpen}
        title="Generate monthly rent"
        onClose={() => setGenerateOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={runGenerate} loading={saving} disabled={!period}>
              Raise rent bills
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Raises one rent bill for every housed student at their room's monthly rent, due on day {settings.rent_due_day ?? 3}. Students already billed for the month are
          skipped.
        </p>
        <TextField label="Month" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
      </Modal>

      <Modal
        open={!!payModal}
        title="Record cash payment"
        onClose={() => setPayModal(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPayModal(null)}>
              Cancel
            </Button>
            <Button onClick={recordPayment} loading={saving} disabled={!payModal || payAmount <= 0 || payAmount > payModal.balance}>
              Record {inr(payAmount)}
            </Button>
          </>
        }
      >
        {payModal && (
          <p className="mb-4 text-sm text-muted-foreground">
            {billLabel(payModal)}: {inr(payModal.amountdue)}
            {payModal.latefine > 0 ? ` + ${inr(payModal.latefine)} late fine` : ''}, balance {inr(payModal.balance)}.
          </p>
        )}
        <TextField label="Amount received (₹)" type="number" min={0} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} />
      </Modal>
      {dialog}
    </div>
  );
}

function StudentFeesPage() {
  const { showToast, showError } = useToast();
  const [fees, setFees] = useState<Fee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<Fee | null>(null);
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [f, p] = await Promise.all([feesApi.me(), feesApi.myPayments()]);
      setFees(f);
      setPayments(p);
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

  const columns = billColumns({
    key: 'actions',
    header: '',
    align: 'right',
    render: (f) => (
      <div className="flex justify-end gap-2">
        {f.amountpaid > 0 && (
          <Button size="sm" variant="ghost" onClick={() => downloadReceipt(f, (e) => showError(e, 'Failed to download receipt.'))}>
            <Receipt /> Receipt
          </Button>
        )}
        {!isPaid(f) && (
          <Button
            size="sm"
            onClick={() => {
              setPaying(f);
              setAmount(f.balance);
            }}
          >
            Pay {inr(f.balance)}
          </Button>
        )}
      </div>
    ),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="My fees" subtitle="Rent, security deposit, AC charges, late fines and receipts" />
      {loading ? (
        <LoadingState />
      ) : (
        <>
          <StudentTiles fees={fees} />
          <Table columns={columns} rows={fees} rowKey={(f) => f.feeid} emptyMessage="No bills yet" emptyHint="Your rent bills will appear here each month." />
          <h2 className="pt-2 text-sm font-medium text-muted-foreground">Payment history</h2>
          <PaymentHistory payments={payments} fees={fees} />
        </>
      )}

      <Modal
        open={!!paying}
        title="Pay online"
        onClose={() => setPaying(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPaying(null)}>
              Cancel
            </Button>
            <Button onClick={pay} loading={saving} disabled={!paying || amount <= 0 || amount > paying.balance}>
              <CreditCard /> Pay {inr(amount)}
            </Button>
          </>
        }
      >
        {paying && (
          <dl className="mb-4 divide-y rounded-lg border text-sm">
            <div className="flex justify-between px-3 py-2">
              <dt className="text-muted-foreground">{billLabel(paying)}</dt>
              <dd className="tabular-nums">{inr(paying.amountdue)}</dd>
            </div>
            {paying.latefine > 0 && (
              <div className="flex justify-between px-3 py-2 text-red-700">
                <dt>Late fine ({paying.latedays} days)</dt>
                <dd className="tabular-nums">{inr(paying.latefine)}</dd>
              </div>
            )}
            {paying.amountpaid > 0 && (
              <div className="flex justify-between px-3 py-2">
                <dt className="text-muted-foreground">Already paid</dt>
                <dd className="tabular-nums">− {inr(paying.amountpaid)}</dd>
              </div>
            )}
            <div className="flex justify-between px-3 py-2 font-medium">
              <dt>Total payable</dt>
              <dd className="tabular-nums">{inr(paying.balance)}</dd>
            </div>
          </dl>
        )}
        <TextField label="Amount to pay (₹)" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        <p className="text-xs text-muted-foreground">The late fine stops increasing once the bill is fully paid. This demo uses a simulated payment gateway; no real money is charged.</p>
      </Modal>
    </div>
  );
}
