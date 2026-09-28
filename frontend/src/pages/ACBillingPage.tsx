import { useEffect, useState } from 'react';
import { Check, Gauge, Snowflake, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { Badge } from '../components/Badge';
import { TextField } from '../components/Form';
import { EmptyState, LoadingState } from '../components/Feedback';
import { inr } from '../components/FloorMap';
import { acApi, roomsApi, settingsApi } from '../api/endpoints';
import type { ACReading, ACRoom, Room } from '../types';
import { periodLabel } from '@/lib/fees';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function lastMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function ACBillingPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const { showToast, showError } = useToast();
  const [rooms, setRooms] = useState<ACRoom[]>([]);
  const [readings, setReadings] = useState<ACReading[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [rate, setRate] = useState(8);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<ACRoom | null>(null);
  const [initial, setInitial] = useState('');
  const [recording, setRecording] = useState<ACRoom | null>(null);
  const [period, setPeriod] = useState(lastMonth());
  const [current, setCurrent] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [r, rd, rm, st] = await Promise.all([acApi.rooms(), acApi.readings(), roomsApi.list(), settingsApi.get()]);
      setRooms(r);
      setReadings(rd);
      setAllRooms(rm);
      setRate(Number(st.values.ac_rate_per_unit ?? 8));
    } catch (err) {
      showError(err, 'Failed to load AC billing.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roomNo = new Map(allRooms.map((r) => [r.roomid, r.roomnumber]));
  const requested = rooms.filter((r) => r.acstatus === 'Requested');
  const active = rooms.filter((r) => r.acstatus === 'Active');

  async function approve() {
    if (!approving) return;
    setBusy(true);
    try {
      await acApi.approve(approving.roomid, Number(initial));
      showToast(`AC activated for room ${approving.roomnumber}.`, 'success');
      setApproving(null);
      load();
    } catch (err) {
      showError(err, 'Failed to approve AC.');
    } finally {
      setBusy(false);
    }
  }

  async function reject(r: ACRoom) {
    try {
      await acApi.reject(r.roomid);
      showToast(`AC request for room ${r.roomnumber} declined.`, 'success');
      load();
    } catch (err) {
      showError(err, 'Failed to decline.');
    }
  }

  async function record() {
    if (!recording) return;
    setBusy(true);
    try {
      const r = await acApi.record(recording.roomid, period, Number(current));
      showToast(
        r.occupants ? `${inr(r.totalamount)} billed: ${inr(r.totalamount / r.occupants)} each to ${r.occupants} students.` : 'Reading saved; the room is empty, so no bills were raised.',
        'success',
      );
      setRecording(null);
      load();
    } catch (err) {
      showError(err, 'Failed to record the reading.');
    } finally {
      setBusy(false);
    }
  }

  const units = recording && current !== '' ? Number(current) - (recording.lastreading ?? 0) : null;

  const columns: Column<ACReading>[] = [
    { key: 'room', header: 'Room', sortValue: (r) => roomNo.get(r.roomid) ?? '', render: (r) => <span className="font-medium">Room {roomNo.get(r.roomid) ?? r.roomid}</span> },
    { key: 'period', header: 'Month', sortValue: (r) => r.period, render: (r) => periodLabel(r.period) },
    {
      key: 'meter',
      header: 'Meter',
      render: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {r.previousreading} → {r.currentreading}
        </span>
      ),
    },
    { key: 'units', header: 'Units', align: 'right', render: (r) => r.currentreading - r.previousreading },
    { key: 'total', header: 'Bill', align: 'right', render: (r) => inr(r.totalamount), sortValue: (r) => r.totalamount },
    {
      key: 'each',
      header: 'Per student',
      align: 'right',
      render: (r) => (r.occupants ? `${inr(r.totalamount / r.occupants)} × ${r.occupants}` : '—'),
    },
  ];

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader title="AC billing" subtitle={`Electricity for AC rooms at ${inr(rate)} per unit, split among the room's students`} />

      {requested.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader>
            <CardTitle>AC requests</CardTitle>
            <CardDescription>Approve once the AC and its sub-meter are installed.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-lg border bg-background">
              {requested.map((r) => (
                <li key={r.roomid} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Room {r.roomnumber}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.hostelname} · Floor {r.floor} · {r.occupants} students
                    </div>
                  </div>
                  {isAdmin ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => reject(r)}>
                        <X /> Decline
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setApproving(r);
                          setInitial('');
                        }}
                      >
                        <Check /> Approve
                      </Button>
                    </div>
                  ) : (
                    <Badge status="REQUESTED" />
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">AC rooms</h2>
        {active.length === 0 ? (
          <Card>
            <EmptyState title="No AC rooms yet" hint="Students can request AC for their room from their dashboard." />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((r) => (
              <Card key={r.roomid} className="gap-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Snowflake className="size-4 text-sky-600" aria-hidden="true" /> Room {r.roomnumber}
                  </CardTitle>
                  <CardDescription>
                    {r.hostelname} · Floor {r.floor} · {r.occupants} students
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-end justify-between gap-2">
                  <div className="text-sm">
                    <div className="text-xs text-muted-foreground">Last reading</div>
                    <div className="font-medium tabular-nums">{r.lastreading ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{r.lastperiod ? periodLabel(r.lastperiod) : 'Starting reading'}</div>
                  </div>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setRecording(r);
                        setCurrent('');
                      }}
                    >
                      <Gauge /> Enter reading
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Bills raised</h2>
        <Table columns={columns} rows={readings} rowKey={(r) => r.readingid} emptyMessage="No AC bills yet" emptyHint="Enter a monthly meter reading to bill a room." />
      </section>

      <Modal
        open={!!approving}
        title={approving ? `Activate AC in room ${approving.roomnumber}` : 'Activate AC'}
        onClose={() => setApproving(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproving(null)}>
              Cancel
            </Button>
            <Button onClick={approve} loading={busy} disabled={initial === '' || Number(initial) < 0}>
              Activate
            </Button>
          </>
        }
      >
        <TextField label="Sub-meter starting reading" type="number" min={0} value={initial} onChange={(e) => setInitial(e.target.value)} />
        <p className="text-xs text-muted-foreground">Next month's usage is measured from this reading.</p>
      </Modal>

      <Modal
        open={!!recording}
        title={recording ? `Meter reading · room ${recording.roomnumber}` : 'Meter reading'}
        onClose={() => setRecording(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRecording(null)}>
              Cancel
            </Button>
            <Button onClick={record} loading={busy} disabled={!period || current === '' || (units != null && units < 0)}>
              Record and bill
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-x-4">
          <TextField label="Month" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          <TextField
            label="Current reading"
            type="number"
            min={recording?.lastreading ?? 0}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            error={units != null && units < 0 ? `At least ${recording?.lastreading}` : undefined}
          />
        </div>
        {recording && units != null && units >= 0 && (
          <dl className="divide-y rounded-lg border text-sm">
            <div className="flex justify-between px-3 py-2">
              <dt className="text-muted-foreground">Consumption</dt>
              <dd className="tabular-nums">
                {units} units × {inr(rate)}
              </dd>
            </div>
            <div className="flex justify-between px-3 py-2 font-medium">
              <dt>Room bill</dt>
              <dd className="tabular-nums">{inr(units * rate)}</dd>
            </div>
            {recording.occupants > 0 && (
              <div className="flex justify-between px-3 py-2">
                <dt className="text-muted-foreground">Per student ({recording.occupants})</dt>
                <dd className="tabular-nums">{inr((units * rate) / recording.occupants)}</dd>
              </div>
            )}
          </dl>
        )}
      </Modal>
    </div>
  );
}
