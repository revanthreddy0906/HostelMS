import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, DoorOpen, Plus, Sparkles } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { Badge } from '../components/Badge';
import { SelectField } from '../components/Form';
import { EmptyState, LoadingState } from '../components/Feedback';
import { RowActions } from '../components/RowActions';
import { PersonCell } from '../components/PersonCell';
import { useConfirm } from '../components/ConfirmDialog';
import { allocationsApi, hostelsApi, roomsApi, studentsApi } from '../api/endpoints';
import type { Allocation, Hostel, Room, Student } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'auto' | 'manual';

export function AllocationsPage() {
  const { showToast, showError } = useToast();
  const { confirm, dialog } = useConfirm();
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [loading, setLoading] = useState(true);

  const [allocateOpen, setAllocateOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('auto');
  const [transferFor, setTransferFor] = useState<Allocation | null>(null);
  const [studentid, setStudentid] = useState<number>(0);
  const [roomid, setRoomid] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [busyStudent, setBusyStudent] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [a, s, r, h] = await Promise.all([allocationsApi.listActive(), studentsApi.list(), roomsApi.list(), hostelsApi.list()]);
      setAllocations(a);
      setStudents(s);
      setRooms(r);
      setHostels(h);
    } catch (err) {
      showError(err, 'Failed to load allocations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const studentById = useMemo(() => new Map(students.map((s) => [s.studentid, s])), [students]);
  const hostelById = useMemo(() => new Map(hostels.map((h) => [h.hostelid, h])), [hostels]);
  const allocated = useMemo(() => new Set(allocations.map((a) => a.studentid)), [allocations]);
  const unallocated = students.filter((s) => !allocated.has(s.studentid));
  const freeBeds = rooms.reduce((n, r) => n + Math.max(0, r.capacity - r.occupiedbeds), 0);

  const nameOf = (id: number) => {
    const s = studentById.get(id);
    return s ? `${s.firstname} ${s.lastname}` : `Student #${id}`;
  };
  const roomLabel = (r: Room) => `${hostelById.get(r.hostelid)?.hostelname ?? 'Block'} · ${r.roomnumber}`;

  /** Rooms with a free bed whose block accepts this student's gender. */
  function roomOptionsFor(sid: number, excludeRoom?: number) {
    const gender = studentById.get(sid)?.gender;
    return rooms
      .filter((r) => r.roomid !== excludeRoom && r.occupiedbeds < r.capacity)
      .filter((r) => {
        const g = hostelById.get(r.hostelid)?.gendertype;
        return !gender || g === 'Mixed' || g === gender;
      })
      .map((r) => ({ value: r.roomid, label: `${roomLabel(r)} (${r.roomtype}) — ${r.capacity - r.occupiedbeds} free` }));
  }

  function openAllocate(sid = 0) {
    setStudentid(sid);
    setRoomid(0);
    setMode('auto');
    setAllocateOpen(true);
  }

  async function allocate() {
    setSaving(true);
    try {
      if (mode === 'auto') await allocationsApi.auto(studentid);
      else await allocationsApi.manual(studentid, roomid);
      showToast(`${nameOf(studentid)} allocated a room.`, 'success');
      setAllocateOpen(false);
      load();
    } catch (err) {
      showError(err, 'Allocation failed.');
    } finally {
      setSaving(false);
    }
  }

  async function quickAuto(s: Student) {
    setBusyStudent(s.studentid);
    try {
      await allocationsApi.auto(s.studentid);
      showToast(`${s.firstname} ${s.lastname} allocated a room.`, 'success');
      load();
    } catch (err) {
      showError(err, 'Auto-allocation failed.');
    } finally {
      setBusyStudent(null);
    }
  }

  async function transfer() {
    if (!transferFor) return;
    setSaving(true);
    try {
      await allocationsApi.changeRoom(transferFor.studentid, roomid);
      showToast(`${nameOf(transferFor.studentid)} moved to a new room.`, 'success');
      setTransferFor(null);
      load();
    } catch (err) {
      showError(err, 'Room transfer failed.');
    } finally {
      setSaving(false);
    }
  }

  async function vacate(a: Allocation) {
    const ok = await confirm({
      title: `Vacate ${nameOf(a.studentid)}'s room?`,
      description: 'The bed becomes free and the allocation is closed as vacated today.',
      confirmLabel: 'Vacate room',
      destructive: true,
    });
    if (!ok) return;
    try {
      await allocationsApi.vacate(a.allocationid);
      showToast('Room vacated.', 'success');
      load();
    } catch (err) {
      showError(err, 'Failed to vacate allocation.');
    }
  }

  const columns: Column<Allocation>[] = [
    {
      key: 'student',
      header: 'Student',
      render: (a) => <PersonCell name={nameOf(a.studentid)} sub={studentById.get(a.studentid)?.rollnumber} />,
      sortValue: (a) => nameOf(a.studentid),
    },
    {
      key: 'room',
      header: 'Room',
      render: (a) => {
        const r = rooms.find((x) => x.roomid === a.roomid);
        return r ? (
          <div>
            <div className="font-medium">{roomLabel(r)}</div>
            <div className="text-xs text-muted-foreground">{r.roomtype}</div>
          </div>
        ) : (
          `Room #${a.roomid}`
        );
      },
    },
    { key: 'date', header: 'Since', render: (a) => a.allocationdate, sortValue: (a) => a.allocationdate },
    { key: 'status', header: 'Status', render: (a) => <Badge status={a.status} /> },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (a) =>
        a.status.toUpperCase() === 'ACTIVE' ? (
          <RowActions
            label={`Actions for ${nameOf(a.studentid)}`}
            actions={[
              {
                label: 'Transfer room',
                icon: ArrowLeftRight,
                onSelect: () => {
                  setRoomid(0);
                  setTransferFor(a);
                },
              },
              { label: 'Vacate', icon: DoorOpen, onSelect: () => vacate(a), destructive: true },
            ]}
          />
        ) : null,
    },
  ];

  const allocateRooms = studentid ? roomOptionsFor(studentid) : [];
  const transferRooms = transferFor ? roomOptionsFor(transferFor.studentid, transferFor.roomid) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Allocations"
        subtitle={loading ? 'Loading…' : `${allocations.length} housed · ${unallocated.length} awaiting a room · ${freeBeds} beds free`}
        actions={
          <Button onClick={() => openAllocate()}>
            <Plus /> Allocate room
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <Table
          columns={columns}
          rows={allocations}
          rowKey={(a) => a.allocationid}
          loading={loading}
          emptyMessage="No active allocations"
          emptyHint="Allocate a room to a student to see them here."
          searchText={(a) => {
            const r = rooms.find((x) => x.roomid === a.roomid);
            return `${nameOf(a.studentid)} ${studentById.get(a.studentid)?.rollnumber ?? ''} ${r ? roomLabel(r) : ''}`;
          }}
          searchPlaceholder="Search by student or room"
        />

        <Card className="h-fit gap-4">
          <CardHeader>
            <CardTitle>Awaiting a room</CardTitle>
            <CardDescription>Students without an active allocation</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingState />
            ) : unallocated.length === 0 ? (
              <EmptyState title="Everyone is housed" />
            ) : (
              <ul className="space-y-2">
                {unallocated.map((s) => (
                  <li key={s.studentid} className="flex items-center justify-between gap-2 rounded-md border p-2.5">
                    <PersonCell name={`${s.firstname} ${s.lastname}`} sub={`${s.rollnumber} · ${s.gender}`} />
                    <Button size="sm" variant="secondary" loading={busyStudent === s.studentid} onClick={() => quickAuto(s)} title="Auto-allocate">
                      <Sparkles /> Auto
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal
        open={allocateOpen}
        title="Allocate a room"
        onClose={() => setAllocateOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAllocateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={allocate} loading={saving} disabled={!studentid || (mode === 'manual' && !roomid)}>
              Allocate
            </Button>
          </>
        }
      >
        <SelectField
          label="Student"
          value={studentid}
          onChange={(e) => {
            setStudentid(Number(e.target.value));
            setRoomid(0);
          }}
          placeholder="Select a student"
          options={unallocated.map((s) => ({ value: s.studentid, label: `${s.firstname} ${s.lastname} (${s.rollnumber})` }))}
        />
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="mb-4">
          <TabsList className="w-full">
            <TabsTrigger value="auto">Auto-assign</TabsTrigger>
            <TabsTrigger value="manual">Choose room</TabsTrigger>
          </TabsList>
        </Tabs>
        {mode === 'auto' ? (
          <p className="rounded-md bg-muted px-3 py-2.5 text-sm text-muted-foreground">
            The first room with a free bed in a block matching the student's gender will be assigned.
          </p>
        ) : !studentid ? (
          <p className="text-sm text-muted-foreground">Select a student to see suitable rooms.</p>
        ) : allocateRooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rooms with free beds match this student.</p>
        ) : (
          <SelectField label="Room" value={roomid} onChange={(e) => setRoomid(Number(e.target.value))} placeholder="Select a room" options={allocateRooms} />
        )}
      </Modal>

      <Modal
        open={!!transferFor}
        title={transferFor ? `Transfer ${nameOf(transferFor.studentid)}` : 'Transfer room'}
        onClose={() => setTransferFor(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTransferFor(null)}>
              Cancel
            </Button>
            <Button onClick={transfer} loading={saving} disabled={!roomid}>
              Transfer
            </Button>
          </>
        }
      >
        {transferRooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No other rooms with free beds match this student.</p>
        ) : (
          <SelectField label="New room" value={roomid} onChange={(e) => setRoomid(Number(e.target.value))} placeholder="Select a room" options={transferRooms} />
        )}
        <p className="text-xs text-muted-foreground">The current allocation is closed as transferred and a new one starts today.</p>
      </Modal>
      {dialog}
    </div>
  );
}
