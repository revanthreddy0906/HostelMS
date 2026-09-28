import { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, UserCog, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { EmptyState, LoadingState } from '../components/Feedback';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { Badge } from '../components/Badge';
import { SelectField, TextField } from '../components/Form';
import { RowActions } from '../components/RowActions';
import { hostelsApi, roomsApi, staffApi } from '../api/endpoints';
import type { Hostel, HostelCreate, Room, RoomCreate, Staff } from '../types';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const ROOM_TYPES = ['Non-AC', 'AC', 'Deluxe'];
const emptyHostel: HostelCreate = { hostelname: '', gendertype: 'Male', totalrooms: 0 };

export function HostelsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const { showToast, showError } = useToast();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [hostelModal, setHostelModal] = useState(false);
  const [roomModal, setRoomModal] = useState(false);
  const [wardenFor, setWardenFor] = useState<Hostel | null>(null);
  const [wardenChoice, setWardenChoice] = useState<number>(0);
  const [hostelForm, setHostelForm] = useState<HostelCreate>(emptyHostel);
  const [roomForm, setRoomForm] = useState<RoomCreate>({ hostelid: 0, roomnumber: '', capacity: 2, roomtype: 'Non-AC' });
  const [hostelFilter, setHostelFilter] = useState<string>('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [h, r] = await Promise.all([hostelsApi.list(), roomsApi.list()]);
      setHostels(h);
      setRooms(r);
      if (h.length) setRoomForm((f) => (f.hostelid ? f : { ...f, hostelid: h[0].hostelid }));
      if (isAdmin) setStaff(await staffApi.list());
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

  const hostelName = (id: number) => hostels.find((h) => h.hostelid === id)?.hostelname ?? `Block #${id}`;
  const staffName = (id?: number | null) => (id ? (staff.find((s) => s.staffid === id)?.fullname ?? `Staff #${id}`) : null);
  const wardens = staff.filter((s) => s.designation.toLowerCase() === 'warden');

  const blockStats = useMemo(
    () =>
      new Map(
        hostels.map((h) => {
          const own = rooms.filter((r) => r.hostelid === h.hostelid);
          const beds = own.reduce((n, r) => n + r.capacity, 0);
          const occupied = own.reduce((n, r) => n + r.occupiedbeds, 0);
          return [h.hostelid, { rooms: own.length, beds, occupied }];
        }),
      ),
    [hostels, rooms],
  );

  async function saveHostel() {
    setSaving(true);
    try {
      await hostelsApi.create(hostelForm);
      showToast(`${hostelForm.hostelname} created.`, 'success');
      setHostelModal(false);
      setHostelForm(emptyHostel);
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
      showToast(`Room ${roomForm.roomnumber} added to ${hostelName(roomForm.hostelid)}.`, 'success');
      setRoomModal(false);
      setRoomForm((f) => ({ ...f, roomnumber: '' }));
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
      showToast(`${h.hostelname} marked ${next.toLowerCase()}.`, 'success');
      load();
    } catch (err) {
      showError(err, 'Failed to update maintenance status.');
    }
  }

  async function saveWarden() {
    if (!wardenFor || !wardenChoice) return;
    setSaving(true);
    try {
      await hostelsApi.assignWarden(wardenFor.hostelid, wardenChoice);
      showToast(`${staffName(wardenChoice)} assigned to ${wardenFor.hostelname}.`, 'success');
      setWardenFor(null);
      load();
    } catch (err) {
      showError(err, 'Failed to assign warden.');
    } finally {
      setSaving(false);
    }
  }

  const visibleRooms = hostelFilter ? rooms.filter((r) => String(r.hostelid) === hostelFilter) : rooms;

  const roomColumns: Column<Room>[] = [
    { key: 'number', header: 'Room', render: (r) => <span className="font-medium">{r.roomnumber}</span>, sortValue: (r) => r.roomnumber },
    { key: 'hostel', header: 'Block', render: (r) => hostelName(r.hostelid), sortValue: (r) => hostelName(r.hostelid) },
    { key: 'type', header: 'Type', render: (r) => r.roomtype, sortValue: (r) => r.roomtype },
    {
      key: 'occ',
      header: 'Occupancy',
      className: 'w-56',
      sortValue: (r) => r.occupiedbeds / (r.capacity || 1),
      render: (r) => (
        <div className="flex items-center gap-3">
          <Progress value={r.capacity ? (r.occupiedbeds / r.capacity) * 100 : 0} className="h-1.5 flex-1" aria-label={`Room ${r.roomnumber} occupancy`} />
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
            {r.occupiedbeds}/{r.capacity}
          </span>
        </div>
      ),
    },
    {
      key: 'free',
      header: 'Free beds',
      align: 'right',
      sortValue: (r) => r.capacity - r.occupiedbeds,
      render: (r) => r.capacity - r.occupiedbeds,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Hostels & Rooms"
        subtitle="Blocks, rooms and bed capacity"
        actions={
          <>
            <Button variant="secondary" onClick={() => setRoomModal(true)} disabled={!hostels.length}>
              <Plus /> Add room
            </Button>
            {isAdmin && (
              <Button onClick={() => setHostelModal(true)}>
                <Plus /> Add hostel
              </Button>
            )}
          </>
        }
      />

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Blocks</h2>
        {loading ? (
          <LoadingState />
        ) : hostels.length === 0 ? (
          <Card>
            <EmptyState title="No hostel blocks yet" hint="Add a hostel block, then add rooms to it." />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {hostels.map((h) => {
              const st = blockStats.get(h.hostelid) ?? { rooms: 0, beds: 0, occupied: 0 };
              const pct = st.beds ? Math.round((st.occupied / st.beds) * 100) : 0;
              const warden = staffName(h.wardenstaffid);
              return (
                <Card key={h.hostelid} className="gap-4">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
                      {h.hostelname}
                    </CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-2">
                      <span>{h.gendertype === 'Mixed' ? 'Mixed' : `${h.gendertype} residents`}</span>
                      <Badge status={h.maintenancestatus || 'OPERATIONAL'} />
                    </CardDescription>
                    {isAdmin && (
                      <CardAction>
                        <RowActions
                          label={`Actions for ${h.hostelname}`}
                          actions={[
                            {
                              label: 'Assign warden',
                              icon: UserCog,
                              onSelect: () => {
                                setWardenFor(h);
                                setWardenChoice(h.wardenstaffid ?? wardens[0]?.staffid ?? 0);
                              },
                            },
                            {
                              label: (h.maintenancestatus || 'OPERATIONAL').toUpperCase() === 'OPERATIONAL' ? 'Mark under maintenance' : 'Mark operational',
                              icon: Wrench,
                              onSelect: () => toggleMaintenance(h),
                            },
                          ]}
                        />
                      </CardAction>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="mb-1.5 flex items-baseline justify-between text-sm">
                        <span className="text-muted-foreground">Occupancy</span>
                        <span className="font-medium tabular-nums">
                          {st.occupied}/{st.beds} beds · {pct}%
                        </span>
                      </div>
                      <Progress value={pct} className="h-1.5" aria-label={`${h.hostelname} occupancy`} />
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Rooms</dt>
                        <dd className="font-medium tabular-nums">
                          {st.rooms}
                          <span className="text-muted-foreground">/{h.totalrooms}</span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Free beds</dt>
                        <dd className="font-medium tabular-nums">{st.beds - st.occupied}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">Warden</dt>
                        <dd className="truncate font-medium">
                          {warden ?? (h.wardenstaffid ? `Staff #${h.wardenstaffid}` : <span className="text-muted-foreground">Unassigned</span>)}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Rooms</h2>
        <Table
          columns={roomColumns}
          rows={visibleRooms}
          rowKey={(r) => r.roomid}
          loading={loading}
          emptyMessage="No rooms yet"
          emptyHint="Add rooms to a block to make beds available for allocation."
          searchText={(r) => `${r.roomnumber} ${r.roomtype} ${hostelName(r.hostelid)}`}
          searchPlaceholder="Search rooms"
          toolbar={
            <SelectField
              label=""
              placeholder="All blocks"
              value={hostelFilter}
              onChange={(e) => setHostelFilter(e.target.value)}
              options={hostels.map((h) => ({ value: String(h.hostelid), label: h.hostelname }))}
              className="w-44"
            />
          }
        />
      </section>

      <Modal
        open={hostelModal}
        title="Add hostel block"
        onClose={() => setHostelModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setHostelModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveHostel} loading={saving} disabled={!hostelForm.hostelname}>
              Create block
            </Button>
          </>
        }
      >
        <TextField label="Block name" placeholder="e.g. Aravali Block" value={hostelForm.hostelname} onChange={(e) => setHostelForm({ ...hostelForm, hostelname: e.target.value })} />
        <SelectField
          label="Residents"
          value={hostelForm.gendertype}
          onChange={(e) => setHostelForm({ ...hostelForm, gendertype: e.target.value })}
          options={[
            { value: 'Male', label: 'Male' },
            { value: 'Female', label: 'Female' },
            { value: 'Mixed', label: 'Mixed' },
          ]}
        />
        <TextField
          label="Planned number of rooms"
          type="number"
          min={0}
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
            <Button onClick={saveRoom} loading={saving} disabled={!roomForm.roomnumber || roomForm.capacity < 1}>
              Add room
            </Button>
          </>
        }
      >
        <SelectField
          label="Block"
          value={roomForm.hostelid}
          onChange={(e) => setRoomForm({ ...roomForm, hostelid: Number(e.target.value) })}
          options={hostels.map((h) => ({ value: h.hostelid, label: h.hostelname }))}
        />
        <div className="grid grid-cols-2 gap-x-4">
          <TextField label="Room number" placeholder="e.g. 105" value={roomForm.roomnumber} onChange={(e) => setRoomForm({ ...roomForm, roomnumber: e.target.value })} />
          <TextField
            label="Beds"
            type="number"
            min={1}
            value={roomForm.capacity}
            onChange={(e) => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })}
          />
        </div>
        <SelectField
          label="Room type"
          value={roomForm.roomtype}
          onChange={(e) => setRoomForm({ ...roomForm, roomtype: e.target.value })}
          options={ROOM_TYPES.map((t) => ({ value: t, label: t }))}
        />
        <p className="text-xs text-muted-foreground">Fees are generated per room type, so match a type that has a fee structure.</p>
      </Modal>

      <Modal
        open={!!wardenFor}
        title={wardenFor ? `Assign warden to ${wardenFor.hostelname}` : 'Assign warden'}
        onClose={() => setWardenFor(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setWardenFor(null)}>
              Cancel
            </Button>
            <Button onClick={saveWarden} loading={saving} disabled={!wardenChoice}>
              Assign
            </Button>
          </>
        }
      >
        {wardens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No staff with the Warden designation yet. Add one on the Staff page.</p>
        ) : (
          <SelectField
            label="Warden"
            value={wardenChoice}
            onChange={(e) => setWardenChoice(Number(e.target.value))}
            options={wardens.map((w) => ({ value: w.staffid, label: w.fullname }))}
          />
        )}
      </Modal>
    </div>
  );
}
