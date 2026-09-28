import { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Snowflake, UserCog, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { EmptyState, LoadingState } from '../components/Feedback';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { SelectField, TextField } from '../components/Form';
import { RowActions } from '../components/RowActions';
import { BedDots, FloorMap, MapLegend, inr } from '../components/FloorMap';
import { hostelsApi, roomsApi, settingsApi, staffApi } from '../api/endpoints';
import type { Hostel, HostelCreate, MapHostel, MapRoom, RoomCreate, SettingsValues, Staff } from '../types';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SHARING = ['3 Sharing', '4 Sharing', '5 Sharing', 'Pentahouse'];
const SETTING_KEY: Record<string, string> = {
  '3 Sharing': 'rent_3_sharing',
  '4 Sharing': 'rent_4_sharing',
  '5 Sharing': 'rent_5_sharing',
  Pentahouse: 'rent_pentahouse',
};
const emptyHostel: HostelCreate = { hostelname: '', gendertype: 'Male', totalrooms: 0 };
const emptyRoom: RoomCreate = { hostelid: 0, roomnumber: '', roomtype: '3 Sharing', floor: 1, capacity: 2, purpose: 'Student', monthlyrent: null };

export function HostelsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const { showToast, showError } = useToast();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [map, setMap] = useState<MapHostel[]>([]);
  const [settings, setSettings] = useState<SettingsValues>({});
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeHostel, setActiveHostel] = useState<string>('');
  const [hostelModal, setHostelModal] = useState(false);
  const [roomModal, setRoomModal] = useState(false);
  const [viewRoom, setViewRoom] = useState<MapRoom | null>(null);
  const [wardenFor, setWardenFor] = useState<Hostel | null>(null);
  const [wardenChoice, setWardenChoice] = useState<number>(0);
  const [hostelForm, setHostelForm] = useState<HostelCreate>(emptyHostel);
  const [roomForm, setRoomForm] = useState<RoomCreate>(emptyRoom);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [h, m, st] = await Promise.all([hostelsApi.list(), roomsApi.map(), settingsApi.get()]);
      setHostels(h);
      setMap(m);
      setSettings(st.values);
      if (h.length) {
        setRoomForm((f) => (f.hostelid ? f : { ...f, hostelid: h[0].hostelid }));
        setActiveHostel((cur) => cur || String(h[0].hostelid));
      }
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

  const stats = useMemo(
    () =>
      new Map(
        map.map((h) => {
          const rooms = h.floors.flatMap((f) => f.rooms);
          const studentRooms = rooms.filter((r) => r.purpose === 'Student');
          return [
            h.hostelid,
            {
              floors: h.floors.length,
              rooms: studentRooms.length,
              parentRooms: rooms.length - studentRooms.length,
              beds: studentRooms.reduce((n, r) => n + r.capacity, 0),
              occupied: studentRooms.reduce((n, r) => n + r.occupiedbeds, 0),
            },
          ];
        }),
      ),
    [map],
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

  const isParentForm = roomForm.purpose === 'Parent';
  const isPentahouse = !isParentForm && roomForm.roomtype === 'Pentahouse';
  const needsCapacity = isParentForm || isPentahouse;
  const shownRent = isParentForm ? 0 : isPentahouse && roomForm.monthlyrent != null ? roomForm.monthlyrent : Number(settings[SETTING_KEY[roomForm.roomtype]] ?? 0);
  const selectedMap = map.find((h) => String(h.hostelid) === activeHostel);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Hostels & Rooms"
        subtitle="Blocks, floors, rooms and beds"
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
              const st = stats.get(h.hostelid) ?? { floors: 0, rooms: 0, parentRooms: 0, beds: 0, occupied: 0 };
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
                    <dl className="grid grid-cols-4 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Floors</dt>
                        <dd className="font-medium tabular-nums">{st.floors}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Rooms</dt>
                        <dd className="font-medium tabular-nums">{st.rooms}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Free beds</dt>
                        <dd className="font-medium tabular-nums">{st.beds - st.occupied}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">Warden</dt>
                        <dd className="truncate font-medium">
                          {!h.wardenstaffid ? (
                            <span className="text-muted-foreground">Unassigned</span>
                          ) : user?.role === 'Warden' && h.wardenstaffid === user.entity_id ? (
                            'You'
                          ) : (
                            (isAdmin && warden) || 'Assigned'
                          )}
                        </dd>
                      </div>
                    </dl>
                    {st.parentRooms > 0 && <p className="text-xs text-amber-700">{st.parentRooms} parent rooms reserved for guests</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {!loading && map.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={activeHostel} onValueChange={setActiveHostel}>
              <TabsList>
                {map.map((h) => (
                  <TabsTrigger key={h.hostelid} value={String(h.hostelid)}>
                    {h.hostelname}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <MapLegend />
          </div>
          {selectedMap && <FloorMap hostel={selectedMap} onSelectRoom={setViewRoom} />}
        </section>
      )}

      <Modal open={!!viewRoom} title={viewRoom ? `Room ${viewRoom.roomnumber}` : 'Room'} onClose={() => setViewRoom(null)}>
        {viewRoom && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
              <span>{viewRoom.purpose === 'Parent' ? 'Parent room · free stay' : viewRoom.roomtype}</span>
              {viewRoom.purpose === 'Student' && <span className="font-medium text-foreground">{inr(viewRoom.monthlyrent)} / month</span>}
              {viewRoom.acstatus === 'Active' && (
                <span className="flex items-center gap-1 text-sky-700">
                  <Snowflake className="size-3.5" /> AC
                </span>
              )}
            </div>
            <BedDots room={viewRoom} />
            <ul className="divide-y rounded-lg border">
              {viewRoom.beds.map((b) => (
                <li key={b.bedid} className="flex items-center justify-between px-3 py-2">
                  <span className="text-muted-foreground">Bed {b.bednumber}</span>
                  {b.studentname ? <span className="font-medium">{b.studentname}</span> : <span className="text-muted-foreground">{viewRoom.purpose === 'Parent' ? 'Guest bed' : 'Free'}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>

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
        <TextField label="Block name" placeholder="e.g. Sunrise Boys PG" value={hostelForm.hostelname} onChange={(e) => setHostelForm({ ...hostelForm, hostelname: e.target.value })} />
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
            <Button onClick={saveRoom} loading={saving} disabled={!roomForm.roomnumber || (needsCapacity && !(roomForm.capacity && roomForm.capacity > 0))}>
              Add room
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-x-4">
          <SelectField
            label="Block"
            value={roomForm.hostelid}
            onChange={(e) => setRoomForm({ ...roomForm, hostelid: Number(e.target.value) })}
            options={hostels.map((h) => ({ value: h.hostelid, label: h.hostelname }))}
          />
          <SelectField
            label="Room for"
            value={roomForm.purpose ?? 'Student'}
            onChange={(e) => setRoomForm({ ...roomForm, purpose: e.target.value as 'Student' | 'Parent' })}
            options={[
              { value: 'Student', label: 'Students' },
              { value: 'Parent', label: 'Parent guests (free)' },
            ]}
          />
          <TextField label="Floor" type="number" min={0} value={roomForm.floor} onChange={(e) => setRoomForm({ ...roomForm, floor: Number(e.target.value) })} />
          <TextField label="Room number" placeholder="e.g. 304" value={roomForm.roomnumber} onChange={(e) => setRoomForm({ ...roomForm, roomnumber: e.target.value })} />
          {!isParentForm && (
            <SelectField
              label="Sharing type"
              value={roomForm.roomtype}
              onChange={(e) => setRoomForm({ ...roomForm, roomtype: e.target.value })}
              options={SHARING.map((t) => ({ value: t, label: t }))}
            />
          )}
          {needsCapacity && (
            <TextField
              label={isParentForm ? 'Guest beds' : 'Beds'}
              type="number"
              min={1}
              value={roomForm.capacity ?? ''}
              onChange={(e) => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })}
            />
          )}
          {isPentahouse && (
            <TextField
              label="Monthly rent (₹)"
              type="number"
              min={0}
              placeholder={settings.rent_pentahouse}
              value={roomForm.monthlyrent ?? ''}
              onChange={(e) => setRoomForm({ ...roomForm, monthlyrent: e.target.value === '' ? null : Number(e.target.value) })}
            />
          )}
        </div>
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {isParentForm
            ? 'Parent rooms are free and are never offered for student allocation.'
            : `Rent: ${inr(shownRent)} per bed per month${isPentahouse ? '' : ` (from Settings for ${roomForm.roomtype})`}. Beds are numbered automatically.`}
        </p>
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
