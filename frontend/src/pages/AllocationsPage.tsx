import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { Badge } from '../components/Badge';
import { SelectField } from '../components/Form';
import { allocationsApi, roomsApi, studentsApi } from '../api/endpoints';
import type { Allocation, Room, Student } from '../types';

export function AllocationsPage() {
  const { showToast, showError } = useToast();
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const [autoModal, setAutoModal] = useState(false);
  const [manualModal, setManualModal] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [studentid, setStudentid] = useState<number>(0);
  const [roomid, setRoomid] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [a, s, r] = await Promise.all([allocationsApi.listActive(), studentsApi.list(), roomsApi.list()]);
      setAllocations(a);
      setStudents(s);
      setRooms(r);
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

  function studentLabel(id: number) {
    const s = students.find((x) => x.studentid === id);
    return s ? `${s.firstname} ${s.lastname} (${s.rollnumber})` : `#${id}`;
  }
  function roomLabel(id: number) {
    const r = rooms.find((x) => x.roomid === id);
    return r ? `Room ${r.roomnumber}` : `#${id}`;
  }

  async function doAuto() {
    setSaving(true);
    try {
      await allocationsApi.auto(studentid);
      showToast('Student auto-allocated.', 'success');
      setAutoModal(false);
      load();
    } catch (err) {
      showError(err, 'Auto-allocation failed.');
    } finally {
      setSaving(false);
    }
  }

  async function doManual() {
    setSaving(true);
    try {
      await allocationsApi.manual(studentid, roomid);
      showToast('Room allocated.', 'success');
      setManualModal(false);
      load();
    } catch (err) {
      showError(err, 'Manual allocation failed.');
    } finally {
      setSaving(false);
    }
  }

  async function doTransfer() {
    setSaving(true);
    try {
      await allocationsApi.changeRoom(studentid, roomid);
      showToast('Room transfer complete.', 'success');
      setTransferModal(false);
      load();
    } catch (err) {
      showError(err, 'Room transfer failed.');
    } finally {
      setSaving(false);
    }
  }

  async function vacate(a: Allocation) {
    if (!confirm(`Vacate allocation for ${studentLabel(a.studentid)}?`)) return;
    try {
      await allocationsApi.vacate(a.allocationid);
      showToast('Allocation vacated.', 'success');
      load();
    } catch (err) {
      showError(err, 'Failed to vacate allocation.');
    }
  }

  const columns: Column<Allocation>[] = [
    { key: 'student', header: 'Student', render: (a) => studentLabel(a.studentid) },
    { key: 'room', header: 'Room', render: (a) => roomLabel(a.roomid) },
    { key: 'date', header: 'Allocated', render: (a) => a.allocationdate, sortValue: (a) => a.allocationdate },
    { key: 'status', header: 'Status', render: (a) => <Badge status={a.status} /> },
    {
      key: 'actions',
      header: '',
      render: (a) =>
        a.status.toUpperCase() === 'ACTIVE' ? (
          <Button size="sm" variant="danger" onClick={() => vacate(a)}>
            Vacate
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Allocations"
        subtitle={`${allocations.length} active allocations`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setTransferModal(true)}>
              Transfer room
            </Button>
            <Button variant="secondary" onClick={() => setManualModal(true)}>
              Manual allocate
            </Button>
            <Button onClick={() => setAutoModal(true)}>Auto allocate</Button>
          </>
        }
      />
      <Card>
        <Table columns={columns} rows={allocations} rowKey={(a) => a.allocationid} loading={loading} />
      </Card>

      <Modal
        open={autoModal}
        title="Auto-allocate a student"
        onClose={() => setAutoModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAutoModal(false)}>
              Cancel
            </Button>
            <Button onClick={doAuto} loading={saving} disabled={!studentid}>
              Allocate
            </Button>
          </>
        }
      >
        <p className="mb-3 text-xs text-neutral-500">
          The system finds a gender-matched room with free capacity automatically.
        </p>
        <SelectField
          label="Student"
          value={studentid}
          onChange={(e) => setStudentid(Number(e.target.value))}
          placeholder="Select student"
          options={students.map((s) => ({ value: s.studentid, label: `${s.firstname} ${s.lastname} (${s.rollnumber})` }))}
        />
      </Modal>

      <Modal
        open={manualModal}
        title="Manually allocate a room"
        onClose={() => setManualModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setManualModal(false)}>
              Cancel
            </Button>
            <Button onClick={doManual} loading={saving} disabled={!studentid || !roomid}>
              Allocate
            </Button>
          </>
        }
      >
        <SelectField
          label="Student"
          value={studentid}
          onChange={(e) => setStudentid(Number(e.target.value))}
          placeholder="Select student"
          options={students.map((s) => ({ value: s.studentid, label: `${s.firstname} ${s.lastname} (${s.rollnumber})` }))}
        />
        <SelectField
          label="Room"
          value={roomid}
          onChange={(e) => setRoomid(Number(e.target.value))}
          placeholder="Select room"
          options={rooms.map((r) => ({ value: r.roomid, label: `${r.roomnumber} (${r.occupiedbeds}/${r.capacity})` }))}
        />
      </Modal>

      <Modal
        open={transferModal}
        title="Transfer to a new room"
        onClose={() => setTransferModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTransferModal(false)}>
              Cancel
            </Button>
            <Button onClick={doTransfer} loading={saving} disabled={!studentid || !roomid}>
              Transfer
            </Button>
          </>
        }
      >
        <SelectField
          label="Student"
          value={studentid}
          onChange={(e) => setStudentid(Number(e.target.value))}
          placeholder="Select student"
          options={students.map((s) => ({ value: s.studentid, label: `${s.firstname} ${s.lastname} (${s.rollnumber})` }))}
        />
        <SelectField
          label="New room"
          value={roomid}
          onChange={(e) => setRoomid(Number(e.target.value))}
          placeholder="Select room"
          options={rooms.map((r) => ({ value: r.roomid, label: `${r.roomnumber} (${r.occupiedbeds}/${r.capacity})` }))}
        />
      </Modal>
    </div>
  );
}
