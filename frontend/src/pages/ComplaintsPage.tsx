import { useEffect, useMemo, useState } from 'react';
import { Check, Droplets, Globe, Plus, Sparkles, Wrench, Zap, type LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { Badge } from '../components/Badge';
import { TextareaField } from '../components/Form';
import { EmptyState, LoadingState } from '../components/Feedback';
import { complaintsApi, staffApi, studentsApi } from '../api/endpoints';
import type { Complaint, Staff, Student } from '../types';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { serverTime } from '@/lib/time';

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'] as const;
const NEXT_ACTION: Record<string, { to: string; label: string } | undefined> = {
  Open: { to: 'In Progress', label: 'Start work' },
  'In Progress': { to: 'Resolved', label: 'Mark resolved' },
  Resolved: { to: 'Closed', label: 'Close ticket' },
};

const CATEGORIES: { value: string; icon: LucideIcon }[] = [
  { value: 'Plumbing', icon: Droplets },
  { value: 'Electrical', icon: Zap },
  { value: 'Cleaning', icon: Sparkles },
  { value: 'Internet', icon: Globe },
  { value: 'Others', icon: Wrench },
];
const categoryIcon = (c: string) => CATEGORIES.find((x) => x.value === c)?.icon ?? Wrench;

const fmtDate = (iso: string) => serverTime(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function StatusSteps({ status }: { status: string }) {
  const idx = STATUSES.indexOf(status as (typeof STATUSES)[number]);
  return (
    <ol className="flex items-center gap-1.5" aria-label={`Status: ${status}`}>
      {STATUSES.map((s, i) => (
        <li key={s} className="flex flex-1 flex-col gap-1">
          <span className={cn('h-1 rounded-full', i <= idx ? 'bg-primary' : 'bg-muted')} />
          <span className={cn('text-[11px]', i === idx ? 'font-medium text-foreground' : 'text-muted-foreground')}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function ComplaintsPage() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === 'Student' ? <StudentComplaints /> : <ManageComplaints />;
}

function StudentComplaints() {
  const { showToast, showError } = useToast();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: '', description: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setComplaints(await complaintsApi.me());
    } catch (err) {
      showError(err, 'Failed to load complaints.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    setSaving(true);
    try {
      await complaintsApi.create(form.category, form.description.trim());
      showToast('Complaint registered and assigned to staff.', 'success');
      setOpen(false);
      setForm({ category: '', description: '' });
      load();
    } catch (err) {
      showError(err, 'Failed to register complaint.');
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...complaints].sort((a, b) => b.createdat.localeCompare(a.createdat));

  return (
    <div>
      <PageHeader
        title="My complaints"
        subtitle="Report maintenance and service issues and track them to resolution"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> Raise complaint
          </Button>
        }
      />
      {loading ? (
        <LoadingState />
      ) : sorted.length === 0 ? (
        <Card>
          <EmptyState title="No complaints raised" hint="Something broken in your room? Raise a complaint and it goes straight to the right staff." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sorted.map((c) => {
            const Icon = categoryIcon(c.category);
            return (
              <Card key={c.complaintid} className="gap-4 px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <div className="font-medium">{c.category}</div>
                      <div className="text-xs text-muted-foreground">Raised {fmtDate(c.createdat)}</div>
                    </div>
                  </div>
                  <Badge status={c.status} />
                </div>
                <p className="text-sm text-muted-foreground">{c.description}</p>
                <StatusSteps status={c.status} />
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        title="Raise a complaint"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} loading={saving} disabled={!form.category || !form.description.trim()}>
              Submit
            </Button>
          </>
        }
      >
        <fieldset className="mb-4">
          <legend className="mb-2 text-sm font-medium">Category</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {CATEGORIES.map(({ value, icon: Icon }) => (
              <label
                key={value}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs transition-colors hover:bg-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                  form.category === value && 'border-primary bg-primary/5 text-primary',
                )}
              >
                <input
                  type="radio"
                  name="category"
                  value={value}
                  checked={form.category === value}
                  onChange={() => setForm({ ...form, category: value })}
                  className="sr-only"
                />
                <Icon className="size-4" aria-hidden="true" />
                {value}
              </label>
            ))}
          </div>
        </fieldset>
        <TextareaField
          label="What's the problem?"
          placeholder="e.g. Bathroom tap in room 101 is leaking"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </Modal>
    </div>
  );
}

function ManageComplaints() {
  const { user } = useAuth();
  const { showToast, showError } = useToast();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('active');
  const [busy, setBusy] = useState<number | null>(null);

  async function load() {
    try {
      const [c, s] = await Promise.all([complaintsApi.list(), studentsApi.list()]);
      setComplaints(c);
      setStudents(s);
      if (user?.role === 'Admin') setStaff(await staffApi.list());
    } catch (err) {
      showError(err, 'Failed to load complaints.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function advance(c: Complaint, to: string) {
    setBusy(c.complaintid);
    try {
      const updated = await complaintsApi.setStatus(c.complaintid, to);
      setComplaints((prev) => prev.map((x) => (x.complaintid === c.complaintid ? updated : x)));
      showToast(`${c.category} ticket marked ${to.toLowerCase()}.`, 'success');
    } catch (err) {
      showError(err, 'Failed to update complaint status.');
    } finally {
      setBusy(null);
    }
  }

  const studentById = useMemo(() => new Map(students.map((s) => [s.studentid, s])), [students]);
  const nameOf = (id: number) => {
    const s = studentById.get(id);
    return s ? `${s.firstname} ${s.lastname}` : `Student #${id}`;
  };
  const assigneeOf = (c: Complaint) => {
    if (!c.assignedstaffid) return <span className="text-muted-foreground">Unassigned</span>;
    if (user?.role === 'Staff' && c.assignedstaffid === user.entity_id) return <span className="font-medium">You</span>;
    return staff.find((s) => s.staffid === c.assignedstaffid)?.fullname ?? `Staff #${c.assignedstaffid}`;
  };

  const counts = useMemo(() => {
    const m: Record<string, number> = { active: 0 };
    for (const c of complaints) {
      m[c.status] = (m[c.status] ?? 0) + 1;
      if (c.status === 'Open' || c.status === 'In Progress') m.active += 1;
    }
    return m;
  }, [complaints]);

  const rows = complaints.filter((c) =>
    filter === 'all' ? true : filter === 'active' ? c.status === 'Open' || c.status === 'In Progress' : c.status === filter,
  );

  const columns: Column<Complaint>[] = [
    {
      key: 'category',
      header: 'Issue',
      sortValue: (c) => c.category,
      render: (c) => {
        const Icon = categoryIcon(c.category);
        return (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="font-medium">{c.category}</div>
              <div className="line-clamp-2 max-w-sm text-xs text-muted-foreground">{c.description}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'student',
      header: 'Raised by',
      render: (c) => (
        <div>
          <div>{nameOf(c.studentid)}</div>
          <div className="text-xs text-muted-foreground">{fmtDate(c.createdat)}</div>
        </div>
      ),
      sortValue: (c) => c.createdat,
    },
    { key: 'assigned', header: 'Assigned to', render: assigneeOf },
    { key: 'status', header: 'Status', render: (c) => <Badge status={c.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => {
        const next = NEXT_ACTION[c.status];
        return next ? (
          <Button size="sm" variant={next.to === 'Closed' ? 'ghost' : 'secondary'} loading={busy === c.complaintid} onClick={() => advance(c, next.to)}>
            {next.to === 'Resolved' && <Check />}
            {next.label}
          </Button>
        ) : null;
      },
    },
  ];

  const tabs: { value: string; label: string; count?: number }[] = [
    { value: 'active', label: 'Active', count: counts.active },
    ...STATUSES.map((s) => ({ value: s, label: s, count: counts[s] ?? 0 })),
    { value: 'all', label: 'All', count: complaints.length },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Complaints" subtitle="Maintenance and service tickets from residents" />
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="h-auto flex-wrap">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              {t.label}
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{t.count}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Table
        columns={columns}
        rows={rows}
        rowKey={(c) => c.complaintid}
        loading={loading}
        emptyMessage={filter === 'active' ? 'No open tickets' : 'No complaints here'}
        emptyHint={filter === 'active' ? 'Everything reported so far has been resolved.' : undefined}
        searchText={(c) => `${c.category} ${c.description} ${nameOf(c.studentid)}`}
        searchPlaceholder="Search complaints"
      />
    </div>
  );
}
