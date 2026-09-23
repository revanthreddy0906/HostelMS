import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { EmptyState } from '../components/Feedback';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { Badge } from '../components/Badge';
import { SelectField, TextField } from '../components/Form';
import { hostelsApi, roomsApi } from '../api/endpoints';
import type { Hostel, HostelCreate, OccupancyRow, Room, RoomCreate } from '../types';

export function HostelsPage() {
  const { showToast, showError } = useToast();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [occupancy, setOccupancy] = useState<OccupancyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hostelModal, setHostelModal] = useState(false);
  const [roomModal, setRoomModal] = useState(false);
  const [hostelForm, setHostelForm] = useState<HostelCreate>({ hostelname: '', gendertype: 'Male', totalrooms: 0 });
  const [roomForm, setRoomForm] = useState<RoomCreate>({ hostelid: 0, roomnumber: '', capacity: 2, roomtype: 'Double' });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [h, r, o] = await Promise.all([hostelsApi.list(), roomsApi.list(), roomsApi.occupancy()]);
      setHostels(h);
      setRooms(r);
      setOccupancy(o);
      if (h.length && !roomForm.hostelid) setRoomForm((f) => ({ ...f, hostelid: h[0].hostelid }));
    } catch (err) {
      showError(err, 'Failed to load hostel data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveHostel() {
    setSaving(true);
    try {
      await hostelsApi.create(hostelForm);
      showToast('Hostel created.', 'success');
      setHostelModal(false);
      setHostelForm({ hostelname: '', gendertype: 'Male', totalrooms: 0 });
      load();
    } catch (err) {
      showError(err, 'Failed to create hostel.');
    } finally {
      setSaving(false);
    }
  }

  async function saveRoom() {
    setSaving(true);
    try {
      await roomsApi.create(roomForm);
      showToast('Room created.', 'success');
      setRoomModal(false);
      load();
    } catch (err) {
      showError(err, 'Failed to create room.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleMaintenance(h: Hostel) {
    const next = (h.maintenancestatus || 'OPERATIONAL').toUpperCase() === 'OPERATIONAL' ? 'MAINTENANCE' : 'OPERATIONAL';
    try {
      await hostelsApi.setMaintenanceStatus(h.hostelid, next);
      showToast(`${h.hostelname} marked ${next}.`, 'success');
      load();
    } catch (err) {
      showError(err, 'Failed to update maintenance status.');
    }
  }

  const hostelColumns: Column<Hostel>[] = [
    { key: 'name', header: 'Hostel', render: (h) => h.hostelname, sortValue: (h) => h.hostelname },
    { key: 'gender', header: 'Gender', render: (h) => h.gendertype },
    { key: 'rooms', header: 'Total rooms', align: 'right', render: (h) => h.totalrooms },
    { key: 'status', header: 'Status', render: (h) => <Badge status={h.maintenancestatus || 'OPERATIONAL'} /> },
    { key: 'warden', header: 'Warden staff ID', render: (h) => h.wardenstaffid ?? '—' },
    {
      key: 'actions',
      header: '',
      render: (h) => (
        <Button size="sm" variant="secondary" onClick={() => toggleMaintenance(h)}>
          Toggle status
        </Button>
      ),
    },
  ];

  const roomColumns: Column<Room>[] = [
    { key: 'hostel', header: 'Hostel', render: (r) => hostels.find((h) => h.hostelid === r.hostelid)?.hostelname ?? r.hostelid },
    { key: 'number', header: 'Room', render: (r) => r.roomnumber, sortValue: (r) => r.roomnumber },
    { key: 'type', header: 'Type', render: (r) => r.roomtype },
    { key: 'occ', header: 'Occupancy', align: 'right', render: (r) => `${r.occupiedbeds}/${r.capacity}` },
  ];

  return (
    <div>
      <PageHeader
        title="Hostels & Rooms"
        subtitle="Manage blocks, rooms, and occupancy"
        actions={
          <>
            <Button variant="secondary" onClick={() => setRoomModal(true)}>
              + Add room
            </Button>
            <Button onClick={() => setHostelModal(true)}>+ Add hostel</Button>
          </>
        }
      />

      <Card title="Hostels">
        <Table columns={hostelColumns} rows={hostels} rowKey={(h) => h.hostelid} loading={loading} />
      </Card>

      <Card title="Rooms" className="mt-6">
        <Table columns={roomColumns} rows={rooms} rowKey={(r) => r.roomid} loading={loading} />
      </Card>

      <Card title="Occupancy overview" className="mt-6">
        {occupancy.length === 0 ? (
          <EmptyState title="No occupancy data" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {occupancy.map((r) => (
              <div key={`${r.hostel}-${r.room}`} className="rounded-lg border border-neutral-200 p-3 text-xs">
                <div className="font-semibold text-neutral-700">{r.hostel} · {r.room}</div>
                <div className="mt-1 text-neutral-500">{r.occupied}/{r.capacity} ({r.free} free) — {r.type}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={hostelModal}
        title="Add hostel"
        onClose={() => setHostelModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setHostelModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveHostel} loading={saving}>
              Create
            </Button>
          </>
        }
      >
        <TextField label="Hostel name" value={hostelForm.hostelname} onChange={(e) => setHostelForm({ ...hostelForm, hostelname: e.target.value })} />
        <SelectField
          label="Gender type"
          value={hostelForm.gendertype}
          onChange={(e) => setHostelForm({ ...hostelForm, gendertype: e.target.value })}
          options={[
            { value: 'Male', label: 'Male' },
            { value: 'Female', label: 'Female' },
          ]}
        />
        <TextField
          label="Total rooms"
          type="number"
          value={hostelForm.totalrooms}
          onChange={(e) => setHostelForm({ ...hostelForm, totalrooms: Number(e.target.value) })}
        />
      </Modal>

      <Modal
        open={roomModal}
        title="Add room"
        onClose={() => setRoomModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRoomModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveRoom} loading={saving}>
              Create
            </Button>
          </>
        }
      >
        <SelectField
          label="Hostel"
          value={roomForm.hostelid}
          onChange={(e) => setRoomForm({ ...roomForm, hostelid: Number(e.target.value) })}
          options={hostels.map((h) => ({ value: h.hostelid, label: h.hostelname }))}
        />
        <TextField label="Room number" value={roomForm.roomnumber} onChange={(e) => setRoomForm({ ...roomForm, roomnumber: e.target.value })} />
        <TextField
          label="Capacity"
          type="number"
          value={roomForm.capacity}
          onChange={(e) => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })}
        />
        <SelectField
          label="Room type"
          value={roomForm.roomtype}
          onChange={(e) => setRoomForm({ ...roomForm, roomtype: e.target.value })}
          options={[
            { value: 'Single', label: 'Single' },
            { value: 'Double', label: 'Double' },
            { value: 'Triple', label: 'Triple' },
            { value: 'Dormitory', label: 'Dormitory' },
          ]}
        />
      </Modal>
    </div>
  );
}
