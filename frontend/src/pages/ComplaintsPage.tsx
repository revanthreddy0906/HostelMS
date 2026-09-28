import { useEffect, useMemo, useState } from 'react';
import {
  Building,
  Droplet,
  EyeOff,
  Lightbulb,
  MessageCircle,
  Plus,
  Sparkles,
  Star,
  UserCog,
  UtensilsCrossed,
  Volume2,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { Badge } from '../components/Badge';
import { SelectField, TextField, TextareaField } from '../components/Form';
import { EmptyState, LoadingState } from '../components/Feedback';
import { complaintsApi, studentsApi } from '../api/endpoints';
import type { Complaint, ComplaintCreate, Student } from '../types';
import { serverTime } from '@/lib/time';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const STATUSES = ['Pending', 'Reviewed', 'In Progress', 'Resolved'] as const;
const NEXT_ACTION: Record<string, { to: string; label: string } | undefined> = {
  Pending: { to: 'Reviewed', label: 'Mark reviewed' },
  Reviewed: { to: 'In Progress', label: 'Start action' },
  'In Progress': { to: 'Resolved', label: 'Mark resolved' },
};

const CATEGORIES: { value: string; icon: LucideIcon }[] = [
  { value: 'Food / Mess', icon: UtensilsCrossed },
  { value: 'Cleanliness', icon: Sparkles },
  { value: 'Water', icon: Droplet },
  { value: 'Wi-Fi', icon: Wifi },
  { value: 'Hostel Facilities', icon: Building },
  { value: 'Administration', icon: UserCog },
  { value: 'Noise', icon: Volume2 },
  { value: 'Suggestions', icon: Lightbulb },
  { value: 'Other', icon: MessageCircle },
];
const categoryIcon = (c: string) => CATEGORIES.find((x) => x.value === c)?.icon ?? MessageCircle;
const fmtDate = (iso: string) => serverTime(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('size-3.5', n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} aria-hidden="true" />
      ))}
    </span>
  );
}

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

function FoodDetails({ c }: { c: Complaint }) {
  if (c.category !== 'Food / Mess' || (!c.meal && !c.rating)) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {c.meal && (
        <span>
          {c.meal}
          {c.mealdate ? ` · ${c.mealdate}` : ''}
        </span>
      )}
      {c.rating ? <Stars value={c.rating} /> : null}
    </div>
  );
}

export function ComplaintsPage() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === 'Student' ? <StudentComplaints /> : <ManageComplaints />;
}

const emptyForm: ComplaintCreate = { category: '', description: '', meal: null, mealdate: null, rating: null, isanonymous: false };

function StudentComplaints() {
  const { showToast, showError } = useToast();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ComplaintCreate>(emptyForm);
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

  const isFood = form.category === 'Food / Mess';

  async function create() {
    setSaving(true);
    try {
      await complaintsApi.create({
        ...form,
        description: form.description.trim(),
        meal: isFood ? form.meal || null : null,
        mealdate: isFood ? form.mealdate || null : null,
        rating: isFood ? form.rating || null : null,
      });
      showToast(isFood ? 'Thanks for the feedback.' : 'Complaint sent to the warden.', 'success');
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      showError(err, 'Failed to submit.');
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...complaints].sort((a, b) => b.createdat.localeCompare(a.createdat));

  return (
    <div>
      <PageHeader
        title="Complaints & feedback"
        subtitle="Food, cleanliness, Wi-Fi, noise and suggestions. Repairs go under Maintenance."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> New complaint or feedback
          </Button>
        }
      />
      {loading ? (
        <LoadingState />
      ) : sorted.length === 0 ? (
        <Card>
          <EmptyState title="Nothing raised yet" hint="Share a complaint, rate a meal or suggest an improvement." />
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
                      <div className="flex items-center gap-1.5 font-medium">
                        {c.category}
                        {c.isanonymous && <EyeOff className="size-3.5 text-muted-foreground" aria-label="Anonymous" />}
                      </div>
                      <div className="text-xs text-muted-foreground">Raised {fmtDate(c.createdat)}</div>
                    </div>
                  </div>
                  <Badge status={c.status} />
                </div>
                <FoodDetails c={c} />
                <p className="text-sm text-muted-foreground">{c.description}</p>
                <StatusSteps status={c.status} />
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        title="New complaint or feedback"
        onClose={() => setOpen(false)}
        wide
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
                  'flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center text-xs transition-colors hover:bg-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                  form.category === value && 'border-primary bg-primary/5 text-primary',
                )}
              >
                <input type="radio" name="category" value={value} checked={form.category === value} onChange={() => setForm({ ...form, category: value })} className="sr-only" />
                <Icon className="size-4" aria-hidden="true" />
                {value}
              </label>
            ))}
          </div>
        </fieldset>
        {isFood && (
          <div className="mb-4 rounded-lg border bg-muted/30 p-3">
            <div className="grid grid-cols-2 gap-x-4">
              <SelectField
                label="Meal"
                placeholder="Select meal"
                value={form.meal ?? ''}
                onChange={(e) => setForm({ ...form, meal: e.target.value || null })}
                options={['Breakfast', 'Lunch', 'Dinner'].map((m) => ({ value: m, label: m }))}
              />
              <TextField label="Date" type="date" max={todayISO()} value={form.mealdate ?? ''} onChange={(e) => setForm({ ...form, mealdate: e.target.value || null })} />
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Rating</span>
              <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={form.rating === n}
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    onClick={() => setForm({ ...form, rating: form.rating === n ? null : n })}
                    className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Star className={cn('size-6', form.rating && n <= form.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <TextareaField
          label={isFood ? 'Feedback' : "What's the issue?"}
          placeholder={isFood ? 'e.g. Food was good but dal was slightly salty.' : 'e.g. Wi-Fi drops every evening on floor 3'}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={!!form.isanonymous} onChange={(e) => setForm({ ...form, isanonymous: e.target.checked })} />
          <span>
            Post anonymously
            <span className="block text-xs text-muted-foreground">Staff won't see your name. You can still track it here.</span>
          </span>
        </label>
      </Modal>
    </div>
  );
}

function ManageComplaints() {
  const { showToast, showError } = useToast();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('open');
  const [busy, setBusy] = useState<number | null>(null);

  async function load() {
    try {
      const [c, s] = await Promise.all([complaintsApi.list(), studentsApi.list()]);
      setComplaints(c);
      setStudents(s);
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
      showToast(`${c.category} complaint marked ${to.toLowerCase()}.`, 'success');
    } catch (err) {
      showError(err, 'Failed to update the complaint.');
    } finally {
      setBusy(null);
    }
  }

  const studentById = useMemo(() => new Map(students.map((s) => [s.studentid, s])), [students]);
  const nameOf = (c: Complaint) => {
    if (c.studentid == null) return 'Anonymous';
    const s = studentById.get(c.studentid);
    return s ? `${s.firstname} ${s.lastname}` : `Student #${c.studentid}`;
  };

  const counts = useMemo(() => {
    const m: Record<string, number> = { open: 0 };
    for (const c of complaints) {
      m[c.status] = (m[c.status] ?? 0) + 1;
      if (c.status !== 'Resolved') m.open += 1;
    }
    return m;
  }, [complaints]);

  const foodRatings = complaints.filter((c) => c.category === 'Food / Mess' && c.rating);
  const avgRating = foodRatings.length ? foodRatings.reduce((n, c) => n + (c.rating ?? 0), 0) / foodRatings.length : null;

  const rows = complaints.filter((c) => (filter === 'all' ? true : filter === 'open' ? c.status !== 'Resolved' : c.status === filter));

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
            <div className="min-w-0 space-y-0.5">
              <div className="font-medium">{c.category}</div>
              <FoodDetails c={c} />
              <div className="line-clamp-2 max-w-md text-xs text-muted-foreground">{c.description}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'student',
      header: 'Raised by',
      sortValue: (c) => c.createdat,
      render: (c) => (
        <div>
          <div className={cn(c.studentid == null && 'flex items-center gap-1 text-muted-foreground')}>
            {c.studentid == null && <EyeOff className="size-3.5" aria-hidden="true" />}
            {nameOf(c)}
          </div>
          <div className="text-xs text-muted-foreground">{fmtDate(c.createdat)}</div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (c) => <Badge status={c.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => {
        const next = NEXT_ACTION[c.status];
        return next ? (
          <Button size="sm" variant="secondary" loading={busy === c.complaintid} onClick={() => advance(c, next.to)}>
            {next.label}
          </Button>
        ) : null;
      },
    },
  ];

  const tabs: { value: string; label: string; count: number }[] = [
    { value: 'open', label: 'Open', count: counts.open },
    ...STATUSES.map((s) => ({ value: s, label: s, count: counts[s] ?? 0 })),
    { value: 'all', label: 'All', count: complaints.length },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Complaints & feedback"
        subtitle={avgRating != null ? `Average food rating ${avgRating.toFixed(1)} / 5 from ${foodRatings.length} reviews` : 'Issues and suggestions from residents'}
      />
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
        emptyMessage={filter === 'open' ? 'No open complaints' : 'Nothing here'}
        searchText={(c) => `${c.category} ${c.description} ${nameOf(c)}`}
        searchPlaceholder="Search complaints"
      />
    </div>
  );
}
