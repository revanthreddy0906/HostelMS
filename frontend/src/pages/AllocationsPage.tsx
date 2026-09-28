import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, DoorOpen, Plus, Sparkles } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { Badge } from '../components/Badge';
import { SelectField, TextField } from '../components/Form';
import { EmptyState, LoadingState } from '../components/Feedback';
import { RowActions } from '../components/RowActions';
import { PersonCell } from '../components/PersonCell';
import { BedDots, FloorMap, MapLegend, inr } from '../components/FloorMap';
import { allocationsApi, roomsApi, studentsApi } from '../api/endpoints';
import type { Allocation, MapHostel, MapRoom, SettlementPreview, Student } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type Mode = 'auto' | 'manual';

interface RoomRef {
  hostel: MapHostel;
  floor: number;
  room: MapRoom;
}

export function AllocationsPage() {
  const { showToast, showError } = useToast();
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [map, setMap] = useState<MapHostel[]>([]);
  const [loading, setLoading] = useState(true);

  const [allocateOpen, setAllocateOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('auto');
  const [transferFor, setTransferFor] = useState<Allocation | null>(null);
  const [studentid, setStudentid] = useState<number>(0);
  const [pickHostel, setPickHostel] = useState<string>('');
  const [pickFloor, setPickFloor] = useState<string>('');
  const [pickRoom, setPickRoom] = useState<MapRoom | null>(null);
  const [pickBed, setPickBed] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyStudent, setBusyStudent] = useState<number | null>(null);

  const [vacating, setVacating] = useState<Allocation | null>(null);
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [deduction, setDeduction] = useState(0);
  const [reason, setReason] = useState('');

  async function load() {
    try {
      const [a, s, m] = await Promise.all([allocationsApi.listActive(), studentsApi.list(), roomsApi.map()]);
      setAllocations(a);
      setStudents(s);
      setMap(m);
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
  const roomById = useMemo(() => {
    const m = new Map<number, RoomRef>();
    map.forEach((h) => h.floors.forEach((f) => f.rooms.forEach((room) => m.set(room.roomid, { hostel: h, floor: f.floor, room }))));
    return m;
  }, [map]);
  const allocated = useMemo(() => new Set(allocations.map((a) => a.studentid)), [allocations]);
  const unallocated = students.filter((s) => !allocated.has(s.studentid));
  const freeBeds = map.reduce(
    (n, h) => n + h.floors.reduce((m, f) => m + f.rooms.filter((r) => r.purpose === 'Student').reduce((k, r) => k + r.capacity - r.occupiedbeds, 0), 0),
    0,
  );

  const nameOf = (id: number) => {
    const s = studentById.get(id);
    return s ? `${s.firstname} ${s.lastname}` : `Student #${id}`;
  };

  /** Blocks that accept the student's gender. */
  function hostelsFor(sid: number) {
    const gender = studentById.get(sid)?.gender;
    return map.filter((h) => !gender || h.gendertype === 'Mixed' || h.gendertype === gender);
  }

  function resetPicker(sid: number) {
    const options = hostelsFor(sid);
    setPickHostel(options[0] ? String(options[0].hostelid) : '');
    setPickFloor('');
    setPickRoom(null);
    setPickBed(null);
  }

  function openAllocate(sid = 0) {
    setStudentid(sid);
    setMode('auto');
    resetPicker(sid);
    setAllocateOpen(true);
  }

  function openTransfer(a: Allocation) {
    setTransferFor(a);
    resetPicker(a.studentid);
  }

  async function allocate() {
    setSaving(true);
    try {
      if (mode === 'auto') await allocationsApi.auto(studentid);
      else await allocationsApi.manual(studentid, pickRoom!.roomid, pickBed);
      showToast(`${nameOf(studentid)} allocated a bed. Security deposit bill raised.`, 'success');
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
      showToast(`${s.firstname} ${s.lastname} allocated a bed.`, 'success');
      load();
    } catch (err) {
      showError(err, 'Auto-allocation failed.');
    } finally {
      setBusyStudent(null);
    }
  }

  async function transfer() {
    if (!transferFor || !pickRoom) return;
    setSaving(true);
    try {
      await allocationsApi.changeRoom(transferFor.studentid, pickRoom.roomid, pickBed);
      showToast(`${nameOf(transferFor.studentid)} moved to room ${pickRoom.roomnumber}.`, 'success');
      setTransferFor(null);
      load();
    } catch (err) {
      showError(err, 'Room transfer failed.');
    } finally {
      setSaving(false);
    }
  }

  async function openVacate(a: Allocation) {
    setVacating(a);
    setPreview(null);
    setDeduction(0);
    setReason('');
    try {
      setPreview(await allocationsApi.settlementPreview(a.allocationid));
    } catch (err) {
      showError(err, 'Could not calculate the settlement.');
      setVacating(null);
    }
  }

  async function settle() {
    if (!vacating) return;
    setSaving(true);
    try {
      const s = await allocationsApi.settle(vacating.allocationid, deduction, reason);
      showToast(`${nameOf(vacating.studentid)} vacated. Refund ${inr(s.refund)}${s.balanceowed > 0 ? `, still owes ${inr(s.balanceowed)}` : ''}.`, 'success');
      setVacating(null);
      load();
    } catch (err) {
      showError(err, 'Settlement failed.');
    } finally {
      setSaving(false);
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
      header: 'Room / bed',
      sortValue: (a) => roomById.get(a.roomid)?.room.roomnumber ?? '',
      render: (a) => {
        const ref = roomById.get(a.roomid);
        return ref ? (
          <div>
            <div className="font-medium">
              Room {ref.room.roomnumber}
              {a.bednumber ? <span className="text-muted-foreground"> · Bed {a.bednumber}</span> : null}
            </div>
            <div className="text-xs text-muted-foreground">
              {ref.hostel.hostelname} · Floor {ref.floor} · {ref.room.roomtype}
            </div>
          </div>
        ) : (
          `Room #${a.roomid}`
        );
      },
    },
    { key: 'rent', header: 'Rent', align: 'right', render: (a) => (roomById.get(a.roomid) ? inr(roomById.get(a.roomid)!.room.monthlyrent) : '—') },
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
              { label: 'Transfer room', icon: ArrowLeftRight, onSelect: () => openTransfer(a) },
              { label: 'Vacate and settle', icon: DoorOpen, onSelect: () => openVacate(a), destructive: true },
            ]}
          />
        ) : null,
    },
  ];

  const pickerSid = transferFor ? transferFor.studentid : studentid;
  const pickerHostels = pickerSid ? hostelsFor(pickerSid) : [];
  const hostel = pickerHostels.find((h) => String(h.hostelid) === pickHostel);
  const floors = hostel?.floors.filter((f) => f.rooms.some((r) => r.purpose === 'Student')) ?? [];
  const floorData = floors.find((f) => String(f.floor) === pickFloor);
  const excludeRoom = transferFor?.roomid;
  const canPick = (r: MapRoom) => r.purpose === 'Student' && r.occupiedbeds < r.capacity && r.roomid !== excludeRoom;

  const picker = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-4">
        <SelectField
          label="Block"
          value={pickHostel}
          onChange={(e) => {
            setPickHostel(e.target.value);
            setPickFloor('');
            setPickRoom(null);
            setPickBed(null);
          }}
          options={pickerHostels.map((h) => ({ value: String(h.hostelid), label: h.hostelname }))}
        />
        <SelectField
          label="Floor"
          value={pickFloor}
          placeholder="All floors"
          onChange={(e) => {
            setPickFloor(e.target.value);
            setPickRoom(null);
            setPickBed(null);
          }}
          options={floors.map((f) => ({ value: String(f.floor), label: `Floor ${f.floor}` }))}
        />
      </div>
      {hostel && (
        <div className="max-h-80 overflow-y-auto rounded-lg border p-3">
          <FloorMap
            hostel={{ ...hostel, floors: floorData ? [floorData] : floors }}
            selectable={canPick}
            onSelectRoom={(r) => {
              setPickRoom(r);
              setPickBed(r.beds.find((b) => !b.studentid)?.bedid ?? null);
            }}
          />
        </div>
      )}
      {pickRoom && (
        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">
              Room {pickRoom.roomnumber} · {pickRoom.roomtype} · {inr(pickRoom.monthlyrent)}/month
            </span>
            <BedDots room={pickRoom} size="sm" />
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Choose a bed">
            {pickRoom.beds.map((b) => (
              <button
                key={b.bedid}
                type="button"
                role="radio"
                aria-checked={pickBed === b.bedid}
                disabled={!!b.studentid}
                onClick={() => setPickBed(b.bedid)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  b.studentid ? 'cursor-not-allowed bg-muted text-muted-foreground line-through' : 'hover:bg-background',
                  pickBed === b.bedid && 'border-primary bg-primary text-primary-foreground hover:bg-primary',
                )}
              >
                Bed {b.bednumber}
              </button>
            ))}
          </div>
        </div>
      )}
      <MapLegend />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Allocations"
        subtitle={loading ? 'Loading…' : `${allocations.length} housed · ${unallocated.length} awaiting a room · ${freeBeds} beds free`}
        actions={
          <Button onClick={() => openAllocate()}>
            <Plus /> Allocate bed
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Table
          columns={columns}
          rows={allocations}
          rowKey={(a) => a.allocationid}
          loading={loading}
          emptyMessage="No active allocations"
          emptyHint="Allocate a bed to a student to see them here."
          searchText={(a) => {
            const ref = roomById.get(a.roomid);
            return `${nameOf(a.studentid)} ${studentById.get(a.studentid)?.rollnumber ?? ''} ${ref ? `${ref.hostel.hostelname} ${ref.room.roomnumber}` : ''}`;
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
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openAllocate(s.studentid)} title="Choose room and bed">
                        Choose
                      </Button>
                      <Button size="sm" variant="secondary" loading={busyStudent === s.studentid} onClick={() => quickAuto(s)} title="Auto-allocate">
                        <Sparkles /> Auto
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal
        open={allocateOpen}
        title="Allocate a bed"
        onClose={() => setAllocateOpen(false)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setAllocateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={allocate} loading={saving} disabled={!studentid || (mode === 'manual' && (!pickRoom || !pickBed))}>
              {mode === 'manual' && pickRoom ? `Allocate room ${pickRoom.roomnumber}` : 'Allocate'}
            </Button>
          </>
        }
      >
        <SelectField
          label="Student"
          value={studentid}
          onChange={(e) => {
            const sid = Number(e.target.value);
            setStudentid(sid);
            resetPicker(sid);
          }}
          placeholder="Select a student"
          options={unallocated.map((s) => ({ value: s.studentid, label: `${s.firstname} ${s.lastname} (${s.rollnumber})` }))}
        />
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="mb-4">
          <TabsList className="w-full">
            <TabsTrigger value="auto">Auto-assign</TabsTrigger>
            <TabsTrigger value="manual">Choose floor, room and bed</TabsTrigger>
          </TabsList>
        </Tabs>
        {mode === 'auto' ? (
          <p className="rounded-md bg-muted px-3 py-2.5 text-sm text-muted-foreground">
            The lowest free bed in a block matching the student's gender is assigned. The security deposit bill is raised on first allocation.
          </p>
        ) : !studentid ? (
          <p className="text-sm text-muted-foreground">Select a student to see suitable rooms.</p>
        ) : (
          picker
        )}
      </Modal>

      <Modal
        open={!!transferFor}
        title={transferFor ? `Transfer ${nameOf(transferFor.studentid)}` : 'Transfer room'}
        onClose={() => setTransferFor(null)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setTransferFor(null)}>
              Cancel
            </Button>
            <Button onClick={transfer} loading={saving} disabled={!pickRoom || !pickBed}>
              {pickRoom ? `Move to room ${pickRoom.roomnumber}` : 'Transfer'}
            </Button>
          </>
        }
      >
        {picker}
        <p className="mt-3 text-xs text-muted-foreground">The current allocation closes as transferred and a new one starts today. No new deposit is charged.</p>
      </Modal>

      <Modal
        open={!!vacating}
        title={vacating ? `Vacate ${nameOf(vacating.studentid)}` : 'Vacate'}
        onClose={() => setVacating(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setVacating(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={settle}
              loading={saving}
              disabled={!preview || deduction < 0 || deduction > preview.availablefordeduction || (deduction > 0 && !reason.trim())}
            >
              Settle and vacate
            </Button>
          </>
        }
      >
        {!preview ? (
          <LoadingState label="Calculating settlement…" />
        ) : (
          <div className="space-y-4 text-sm">
            <dl className="divide-y rounded-lg border">
              <Row label="Security deposit held" value={inr(preview.depositheld)} />
              <Row
                label={`Pending dues${preview.pendingbills.length ? ` (${preview.pendingbills.length} bills incl. late fines)` : ''}`}
                value={preview.pendingdues ? `− ${inr(preview.pendingdues)}` : inr(0)}
              />
              <Row label="Deduction" value={deduction ? `− ${inr(deduction)}` : inr(0)} />
              <Row label="Refund to student" value={inr(Math.max(0, preview.availablefordeduction - deduction))} strong />
              {preview.balanceowed > 0 && <Row label="Still owed after deposit" value={inr(preview.balanceowed)} tone="text-red-700" />}
            </dl>
            {preview.pendingbills.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {preview.pendingbills.map((b) => (
                  <li key={b.feeid} className="flex justify-between">
                    <span>
                      {b.billtype} {b.period ?? ''}
                      {b.latefine > 0 ? ` (fine ${inr(b.latefine)})` : ''}
                    </span>
                    <span className="tabular-nums">{inr(b.balance)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-[140px_1fr] gap-x-4">
              <TextField
                label="Deduction (₹)"
                type="number"
                min={0}
                max={preview.availablefordeduction}
                value={deduction}
                onChange={(e) => setDeduction(Number(e.target.value))}
                error={deduction > preview.availablefordeduction ? `Max ${inr(preview.availablefordeduction)}` : undefined}
              />
              <TextField label="Reason" placeholder="e.g. Damaged furniture" value={reason} onChange={(e) => setReason(e.target.value)} disabled={!deduction} />
            </div>
            <p className="text-xs text-muted-foreground">The bed becomes free immediately. All bills, payments and this settlement stay on record.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('tabular-nums', strong && 'text-base font-semibold', tone)}>{value}</dd>
    </div>
  );
}
