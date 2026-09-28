import { useEffect, useMemo, useState } from 'react';
import { Check, Image as ImageIcon, Play, Plus, UserCog, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { Badge } from '../components/Badge';
import { SelectField, TextareaField } from '../components/Form';
import { EmptyState, LoadingState } from '../components/Feedback';
import { RowActions, type RowAction } from '../components/RowActions';
import { PhotoInput } from '../components/PhotoInput';
import { maintenanceApi, roomsApi, staffApi, studentsApi } from '../api/endpoints';
import type { MaintenanceRequest, Room, Staff, Student } from '../types';
import { serverTime } from '@/lib/time';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const STEPS = ['Pending', 'Assigned', 'In Progress', 'Resolved'];
const fmt = (iso: string) => serverTime(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const PRIORITY_RANK: Record<string, number> = { Emergency: 0, High: 1, Medium: 2, Low: 3 };

function Steps({ status }: { status: string }) {
  if (status === 'Rejected') return <p className="text-xs font-medium text-red-700">Rejected</p>;
  const idx = STEPS.indexOf(status);
  return (
    <ol className="flex items-center gap-1.5" aria-label={`Status: ${status}`}>
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-1 flex-col gap-1">
          <span className={cn('h-1 rounded-full', i <= idx ? 'bg-primary' : 'bg-muted')} />
          <span className={cn('text-[11px]', i === idx ? 'font-medium text-foreground' : 'text-muted-foreground')}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function MaintenancePage() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === 'Student' ? <StudentMaintenance /> : <ManageMaintenance />;
}

function StudentMaintenance() {
  const { showToast, showError } = useToast();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [options, setOptions] = useState<{ categories: string[]; priorities: string[] }>({ categories: [], priorities: [] });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: '', priority: 'Medium', description: '', photo: null as string | null });
  const [saving, setSaving] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  async function load() {
    try {
      const [r, o] = await Promise.all([maintenanceApi.me(), maintenanceApi.options()]);
      setRequests(r);
      setOptions(o);
    } catch (err) {
      showError(err, 'Failed to load maintenance requests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    setSaving(true);
    try {
      const r = await maintenanceApi.create(form);
      showToast(r.status === 'Assigned' ? 'Request raised and assigned to maintenance staff.' : 'Request raised; the warden will assign it.', 'success');
      setOpen(false);
      setForm({ category: '', priority: 'Medium', description: '', photo: null });
      load();
    } catch (err) {
      showError(err, 'Failed to raise the request.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Maintenance"
        subtitle="Report anything in your room that needs repair"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> Report a problem
          </Button>
        }
      />
      {loading ? (
        <LoadingState />
      ) : requests.length === 0 ? (
        <Card>
          <EmptyState title="No repair requests" hint="Fan not working? Tap leaking? Report it and the right staff member is assigned automatically." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {requests.map((r) => (
            <Card key={r.requestid} className="gap-3 px-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{r.category}</div>
                  <div className="text-xs text-muted-foreground">Reported {fmt(r.createdat)}</div>
                </div>
                <Badge status={r.priority} />
              </div>
              <p className="text-sm text-muted-foreground">{r.description}</p>
              {r.photo && (
                <button type="button" onClick={() => setViewPhoto(r.photo!)} className="w-fit">
                  <img src={r.photo} alt={`${r.category} problem`} className="h-20 rounded-md border object-cover" />
                </button>
              )}
              {r.resolutionnote && <p className="rounded-md bg-muted px-3 py-2 text-xs">{r.resolutionnote}</p>}
              <Steps status={r.status} />
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        title="Report a problem"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={saving} disabled={!form.category || !form.description.trim()}>
              Submit request
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-x-4">
          <SelectField
            label="What needs fixing?"
            placeholder="Select"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            options={options.categories.map((c) => ({ value: c, label: c }))}
          />
          <SelectField
            label="Priority"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            options={options.priorities.map((p) => ({ value: p, label: p }))}
          />
        </div>
        <TextareaField label="Describe the problem" placeholder="e.g. Ceiling fan makes a grinding noise" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <PhotoInput value={form.photo} onChange={(photo) => setForm({ ...form, photo })} />
      </Modal>

      <Modal open={!!viewPhoto} title="Photo" onClose={() => setViewPhoto(null)} wide>
        {viewPhoto && <img src={viewPhoto} alt="Reported problem" className="mx-auto max-h-[70vh] rounded-md" />}
      </Modal>
    </div>
  );
}

function ManageMaintenance() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const canReject = user?.role === 'Admin' || user?.role === 'Warden';
  const { showToast, showError } = useToast();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [assigning, setAssigning] = useState<MaintenanceRequest | null>(null);
  const [assignTo, setAssignTo] = useState(0);
  const [noteFor, setNoteFor] = useState<{ req: MaintenanceRequest; to: 'Resolved' | 'Rejected' } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  async function load() {
    try {
      const [r, s, rm] = await Promise.all([maintenanceApi.list(), studentsApi.list(), roomsApi.list()]);
      setRequests(r);
      setStudents(s);
      setRooms(rm);
      if (isAdmin) setStaff(await staffApi.list());
    } catch (err) {
      showError(err, 'Failed to load maintenance requests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const studentName = useMemo(() => new Map(students.map((s) => [s.studentid, `${s.firstname} ${s.lastname}`])), [students]);
  const roomNo = useMemo(() => new Map(rooms.map((r) => [r.roomid, r.roomnumber])), [rooms]);
  const staffName = (id?: number | null) => {
    if (!id) return <span className="text-muted-foreground">Unassigned</span>;
    if (user?.role === 'Staff' && id === user.entity_id) return <span className="font-medium">You</span>;
    return staff.find((s) => s.staffid === id)?.fullname ?? 'Assigned';
  };
  const repairStaff = staff.filter((s) => ['Maintenance', 'Technician', 'Cleaner'].includes(s.designation));

  function replace(updated: MaintenanceRequest) {
    setRequests((prev) => prev.map((r) => (r.requestid === updated.requestid ? updated : r)));
  }

  async function setStatus(req: MaintenanceRequest, to: string, n?: string) {
    setBusy(true);
    try {
      replace(await maintenanceApi.setStatus(req.requestid, to, n));
      showToast(`${req.category} request marked ${to.toLowerCase()}.`, 'success');
      setNoteFor(null);
      setNote('');
    } catch (err) {
      showError(err, 'Failed to update the request.');
    } finally {
      setBusy(false);
    }
  }

  async function assign() {
    if (!assigning) return;
    setBusy(true);
    try {
      replace(await maintenanceApi.assign(assigning.requestid, assignTo));
      showToast('Request assigned.', 'success');
      setAssigning(null);
    } catch (err) {
      showError(err, 'Failed to assign.');
    } finally {
      setBusy(false);
    }
  }

  const isOpen = (r: MaintenanceRequest) => !['Resolved', 'Rejected'].includes(r.status);
  const rows = requests
    .filter((r) => (filter === 'open' ? isOpen(r) : filter === 'all' ? true : r.status === filter))
    .sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.createdat.localeCompare(a.createdat));

  const columns: Column<MaintenanceRequest>[] = [
    {
      key: 'issue',
      header: 'Problem',
      sortValue: (r) => r.category,
      render: (r) => (
        <div className="flex items-start gap-3">
          {r.photo ? (
            <button type="button" onClick={() => setViewPhoto(r.photo!)} className="shrink-0" aria-label="View photo">
              <img src={r.photo} alt="" className="size-10 rounded-md border object-cover" />
            </button>
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <ImageIcon className="size-4" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <div className="font-medium">{r.category}</div>
            <div className="line-clamp-2 max-w-sm text-xs text-muted-foreground">{r.description}</div>
            {r.resolutionnote && <div className="mt-0.5 text-xs italic text-muted-foreground">“{r.resolutionnote}”</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'where',
      header: 'Reported by',
      render: (r) => (
        <div>
          <div>{studentName.get(r.studentid) ?? `Student #${r.studentid}`}</div>
          <div className="text-xs text-muted-foreground">
            {r.roomid ? `Room ${roomNo.get(r.roomid) ?? r.roomid} · ` : ''}
            {fmt(r.createdat)}
          </div>
        </div>
      ),
    },
    { key: 'priority', header: 'Priority', sortValue: (r) => PRIORITY_RANK[r.priority], render: (r) => <Badge status={r.priority} /> },
    { key: 'staff', header: 'Assigned to', render: (r) => staffName(r.assignedstaffid) },
    { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (r) => {
        const actions: RowAction[] = [];
        if (r.status === 'Assigned') actions.push({ label: 'Start work', icon: Play, onSelect: () => setStatus(r, 'In Progress') });
        if (r.status === 'In Progress') actions.push({ label: 'Mark resolved', icon: Check, onSelect: () => setNoteFor({ req: r, to: 'Resolved' }) });
        if (isAdmin && isOpen(r))
          actions.push({
            label: r.assignedstaffid ? 'Reassign' : 'Assign',
            icon: UserCog,
            onSelect: () => {
              setAssigning(r);
              setAssignTo(r.assignedstaffid ?? repairStaff[0]?.staffid ?? 0);
            },
          });
        if (canReject && ['Pending', 'Assigned'].includes(r.status))
          actions.push({ label: 'Reject', icon: XCircle, destructive: true, onSelect: () => setNoteFor({ req: r, to: 'Rejected' }) });
        return actions.length ? <RowActions label={`Actions for ${r.category} request`} actions={actions} /> : null;
      },
    },
  ];

  const counts = { open: requests.filter(isOpen).length, Resolved: requests.filter((r) => r.status === 'Resolved').length, Rejected: requests.filter((r) => r.status === 'Rejected').length };

  return (
    <div className="space-y-4">
      <PageHeader title="Maintenance" subtitle={user?.role === 'Staff' ? 'Repair jobs assigned to you' : 'Repair requests from residents, highest priority first'} />
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="open">Open ({counts.open})</TabsTrigger>
          <TabsTrigger value="Resolved">Resolved ({counts.Resolved})</TabsTrigger>
          <TabsTrigger value="Rejected">Rejected ({counts.Rejected})</TabsTrigger>
          <TabsTrigger value="all">All ({requests.length})</TabsTrigger>
        </TabsList>
      </Tabs>
      <Table
        columns={columns}
        rows={rows}
        rowKey={(r) => r.requestid}
        loading={loading}
        emptyMessage={filter === 'open' ? 'No open repair jobs' : 'Nothing here'}
        searchText={(r) => `${r.category} ${r.description} ${studentName.get(r.studentid) ?? ''} ${r.roomid ? roomNo.get(r.roomid) : ''}`}
        searchPlaceholder="Search requests"
      />

      <Modal
        open={!!assigning}
        title="Assign repair"
        onClose={() => setAssigning(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssigning(null)}>
              Cancel
            </Button>
            <Button onClick={assign} loading={busy} disabled={!assignTo}>
              Assign
            </Button>
          </>
        }
      >
        <SelectField
          label="Staff member"
          value={assignTo}
          onChange={(e) => setAssignTo(Number(e.target.value))}
          options={repairStaff.map((s) => ({ value: s.staffid, label: `${s.fullname} (${s.designation})` }))}
        />
      </Modal>

      <Modal
        open={!!noteFor}
        title={noteFor?.to === 'Rejected' ? 'Reject request' : 'Mark resolved'}
        onClose={() => setNoteFor(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setNoteFor(null)}>
              Cancel
            </Button>
            <Button
              variant={noteFor?.to === 'Rejected' ? 'danger' : 'primary'}
              onClick={() => noteFor && setStatus(noteFor.req, noteFor.to, note)}
              loading={busy}
              disabled={noteFor?.to === 'Rejected' && !note.trim()}
            >
              {noteFor?.to === 'Rejected' ? 'Reject' : 'Mark resolved'}
            </Button>
          </>
        }
      >
        <TextareaField
          label={noteFor?.to === 'Rejected' ? 'Reason' : 'What was done? (optional)'}
          placeholder={noteFor?.to === 'Rejected' ? 'e.g. Not a fault; the switch was off' : 'e.g. Replaced fan capacitor'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Modal>

      <Modal open={!!viewPhoto} title="Photo" onClose={() => setViewPhoto(null)} wide>
        {viewPhoto && <img src={viewPhoto} alt="Reported problem" className="mx-auto max-h-[70vh] rounded-md" />}
      </Modal>
    </div>
  );
}
