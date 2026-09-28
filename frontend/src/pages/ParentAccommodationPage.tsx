import { useEffect, useMemo, useState } from 'react';
import { BedDouble, LogIn, LogOut, Plus, XCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { Badge } from '../components/Badge';
import { SelectField, TextField } from '../components/Form';
import { EmptyState, LoadingState } from '../components/Feedback';
import { RowActions, type RowAction } from '../components/RowActions';
import { PersonCell } from '../components/PersonCell';
import { useConfirm } from '../components/ConfirmDialog';
import { parentsApi, studentsApi } from '../api/endpoints';
import type { ParentGuest, ParentGuestCreate, ParentRoom, Student } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const emptyForm: ParentGuestCreate = { guestname: '', relation: 'Father', studentid: 0, phone: '', idproof: '', roomid: 0, arrivaldate: '', departuredate: '' };
const RELATIONS = ['Father', 'Mother', 'Guardian', 'Sibling', 'Grandparent', 'Other'];

export function ParentAccommodationPage() {
  const { showToast, showError } = useToast();
  const { confirm, dialog } = useConfirm();
  const [rooms, setRooms] = useState<ParentRoom[]>([]);
  const [guests, setGuests] = useState<ParentGuest[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ParentGuestCreate>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [r, g, s] = await Promise.all([parentsApi.rooms(), parentsApi.guests(), studentsApi.list()]);
      setRooms(r);
      setGuests(g);
      setStudents(s);
    } catch (err) {
      showError(err, 'Failed to load parent accommodation.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const studentById = useMemo(() => new Map(students.map((s) => [s.studentid, s])), [students]);
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.roomid, r])), [rooms]);

  async function book() {
    setSaving(true);
    try {
      await parentsApi.book(form);
      showToast(`Free stay booked for ${form.guestname}.`, 'success');
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      showError(err, 'Booking failed.');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(g: ParentGuest, status: string) {
    if (status === 'Cancelled') {
      const ok = await confirm({ title: `Cancel ${g.guestname}'s stay?`, confirmLabel: 'Cancel stay', destructive: true });
      if (!ok) return;
    }
    try {
      const updated = await parentsApi.setStatus(g.guestid, status);
      setGuests((prev) => prev.map((x) => (x.guestid === g.guestid ? updated : x)));
      showToast(status === 'Staying' ? `${g.guestname} checked in.` : status === 'Departed' ? `${g.guestname} checked out.` : 'Stay cancelled.', 'success');
      load();
    } catch (err) {
      showError(err, 'Failed to update the stay.');
    }
  }

  const columns: Column<ParentGuest>[] = [
    {
      key: 'guest',
      header: 'Guest',
      sortValue: (g) => g.guestname,
      render: (g) => <PersonCell name={g.guestname} sub={`${g.relation} · ${g.phone}`} />,
    },
    {
      key: 'student',
      header: 'Visiting',
      render: (g) => {
        const s = studentById.get(g.studentid);
        return s ? (
          <div>
            <div>
              {s.firstname} {s.lastname}
            </div>
            <div className="text-xs text-muted-foreground">{s.rollnumber}</div>
          </div>
        ) : (
          `Student #${g.studentid}`
        );
      },
    },
    { key: 'room', header: 'Room', render: (g) => roomById.get(g.roomid)?.roomnumber ?? g.roomid },
    {
      key: 'dates',
      header: 'Stay',
      sortValue: (g) => g.arrivaldate,
      render: (g) => (
        <div>
          <div>
            {g.arrivaldate} → {g.departuredate}
          </div>
          <div className="text-xs text-muted-foreground">ID: {g.idproof}</div>
        </div>
      ),
    },
    { key: 'charge', header: 'Charge', align: 'right', render: () => <span className="text-emerald-700">Free</span> },
    { key: 'status', header: 'Status', render: (g) => <Badge status={g.status} /> },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (g) => {
        const actions: RowAction[] = [];
        if (g.status === 'Booked') actions.push({ label: 'Check in', icon: LogIn, onSelect: () => setStatus(g, 'Staying') });
        if (g.status === 'Staying') actions.push({ label: 'Check out', icon: LogOut, onSelect: () => setStatus(g, 'Departed') });
        if (g.status === 'Booked') actions.push({ label: 'Cancel', icon: XCircle, destructive: true, onSelect: () => setStatus(g, 'Cancelled') });
        return actions.length ? <RowActions label={`Actions for ${g.guestname}`} actions={actions} /> : null;
      },
    },
  ];

  const staying = guests.filter((g) => g.status === 'Staying').length;
  const upcoming = guests.filter((g) => g.status === 'Booked').length;

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parent accommodation"
        subtitle={`Free stays for visiting parents and guardians · ${staying} staying now · ${upcoming} upcoming`}
        actions={
          <Button onClick={() => setOpen(true)} disabled={!rooms.length}>
            <Plus /> Book a stay
          </Button>
        }
      />

      {rooms.length === 0 ? (
        <Card>
          <EmptyState title="No parent rooms" hint="Add rooms with 'Room for: Parent guests' on the Hostels & Rooms page." />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {rooms.map((r) => (
            <Card key={r.roomid} className="gap-2 py-4">
              <CardHeader className="px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BedDouble className="size-4 text-amber-600" aria-hidden="true" /> {r.roomnumber}
                </CardTitle>
                <CardDescription className="text-xs">
                  {r.hostelname} · Floor {r.floor}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 px-4">
                <Progress value={(r.staying / r.capacity) * 100} className="h-1.5" aria-label={`Room ${r.roomnumber} guests`} />
                <div className="text-xs text-muted-foreground tabular-nums">
                  {r.staying}/{r.capacity} beds in use
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Table
        columns={columns}
        rows={guests}
        rowKey={(g) => g.guestid}
        emptyMessage="No stays booked"
        searchText={(g) => {
          const s = studentById.get(g.studentid);
          return `${g.guestname} ${g.relation} ${s ? `${s.firstname} ${s.lastname} ${s.rollnumber}` : ''}`;
        }}
        searchPlaceholder="Search guests or students"
      />

      <Modal
        open={open}
        title="Book a free parent stay"
        onClose={() => setOpen(false)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={book}
              loading={saving}
              disabled={
                !form.guestname.trim() || !form.studentid || !form.phone.trim() || !form.idproof.trim() || !form.roomid || !form.arrivaldate || !form.departuredate || form.departuredate < form.arrivaldate
              }
            >
              Book stay · ₹0
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField label="Guest name" value={form.guestname} onChange={(e) => setForm({ ...form, guestname: e.target.value })} />
          <SelectField label="Relation" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} options={RELATIONS.map((r) => ({ value: r, label: r }))} />
          <SelectField
            label="Student"
            placeholder="Select student"
            value={form.studentid}
            onChange={(e) => setForm({ ...form, studentid: Number(e.target.value) })}
            options={students.filter((s) => s.residentstatus === 'ACTIVE').map((s) => ({ value: s.studentid, label: `${s.firstname} ${s.lastname} (${s.rollnumber})` }))}
          />
          <TextField label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <TextField label="ID proof" placeholder="e.g. Aadhaar XXXX-1234" value={form.idproof} onChange={(e) => setForm({ ...form, idproof: e.target.value })} />
          <SelectField
            label="Parent room"
            placeholder="Select room"
            value={form.roomid}
            onChange={(e) => setForm({ ...form, roomid: Number(e.target.value) })}
            options={rooms.map((r) => ({ value: r.roomid, label: `${r.roomnumber} (${r.capacity} beds)` }))}
          />
          <TextField label="Arrival" type="date" min={todayISO()} value={form.arrivaldate} onChange={(e) => setForm({ ...form, arrivaldate: e.target.value })} />
          <TextField
            label="Departure"
            type="date"
            min={form.arrivaldate || todayISO()}
            value={form.departuredate}
            onChange={(e) => setForm({ ...form, departuredate: e.target.value })}
            error={form.arrivaldate && form.departuredate && form.departuredate < form.arrivaldate ? 'Must be after arrival' : undefined}
          />
        </div>
        <p className="text-xs text-muted-foreground">Parent stays are free. The booking is refused if the room's beds are already taken on those dates.</p>
      </Modal>
      {dialog}
    </div>
  );
}
