import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BedDouble, DoorOpen, Plus, ShieldCheck, Snowflake, UtensilsCrossed, Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  acApi,
  allocationsApi,
  announcementsApi,
  feesApi,
  hostelsApi,
  leavesApi,
  maintenanceApi,
  menuApi,
  roomsApi,
  studentsApi,
} from '@/api/endpoints';
import type { Allocation, Announcement, Fee, Hostel, Leave, MaintenanceRequest, MenuDay, Room, Student } from '@/types';
import { Badge } from '@/components/Badge';
import { inr } from '@/components/FloorMap';
import { billLabel } from '@/lib/fees';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TodayMenu, todayName } from '../FoodMenuPage';
import { NoticeList } from '../NoticesPage';
import { DashboardHeader, EmptyNote, KpiCard, ListSkeleton, Stat } from './shared';

export function StudentDashboard() {
  const { user } = useAuth();
  const { showError, showToast } = useToast();
  const [me, setMe] = useState<Student | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [repairs, setRepairs] = useState<MaintenanceRequest[]>([]);
  const [menu, setMenu] = useState<MenuDay[]>([]);
  const [notices, setNotices] = useState<Announcement[]>([]);
  const [allocation, setAllocation] = useState<Allocation | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingAc, setRequestingAc] = useState(false);

  const studentId = user?.entity_id ?? null;

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [profile, f, l, m, mn, n, a] = await Promise.all([
          studentsApi.me(),
          feesApi.me(),
          leavesApi.me(),
          maintenanceApi.me(),
          menuApi.week(),
          announcementsApi.list(),
          allocationsApi.forStudent(studentId),
        ]);
        setMe(profile);
        setFees(f);
        setLeaves(l);
        setRepairs(m);
        setMenu(mn);
        setNotices(n);
        setAllocation(a);
        if (a) {
          const [rooms, hostels] = await Promise.allSettled([roomsApi.list(), hostelsApi.list()]);
          const r = rooms.status === 'fulfilled' ? (rooms.value.find((x) => x.roomid === a.roomid) ?? null) : null;
          setRoom(r);
          if (r && hostels.status === 'fulfilled') setHostel(hostels.value.find((h) => h.hostelid === r.hostelid) ?? null);
        }
      } catch (err) {
        showError(err, 'Failed to load your dashboard.');
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId, showError]);

  async function requestAc() {
    if (!room) return;
    setRequestingAc(true);
    try {
      setRoom(await acApi.request(room.roomid));
      showToast('AC requested for your room. The admin will review it.', 'success');
    } catch (err) {
      showError(err, 'Could not request AC.');
    } finally {
      setRequestingAc(false);
    }
  }

  const unpaid = fees.filter((f) => f.paymentstatus.toUpperCase() !== 'PAID' && f.billtype !== 'Deposit');
  const dues = unpaid.reduce((n, f) => n + f.balance, 0);
  const fines = unpaid.reduce((n, f) => n + f.latefine, 0);
  const deposit = fees.find((f) => f.billtype === 'Deposit');
  const latestLeave = [...leaves].sort((a, b) => b.leaveid - a.leaveid)[0];
  const openRepairs = repairs.filter((r) => !['Resolved', 'Rejected'].includes(r.status));
  const today = menu.find((d) => d.day === todayName());
  const pref = (me?.foodpreference as 'Veg' | 'Non-Veg' | null) ?? null;

  return (
    <div className="space-y-6">
      <DashboardHeader title={me ? `Welcome, ${me.firstname}` : 'My dashboard'} subtitle="Your room, dues, meals and requests" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="My room"
          icon={BedDouble}
          loading={loading}
          footer={allocation && room ? `${hostel?.hostelname ?? 'Block'} · Floor ${room.floor} · ${room.roomtype}` : 'Not allocated yet'}
        >
          <span className="text-3xl font-semibold tracking-tight">{allocation ? (room ? room.roomnumber : `#${allocation.roomid}`) : '—'}</span>
          {allocation?.bednumber && <span className="ml-2 text-sm text-muted-foreground">Bed {allocation.bednumber}</span>}
        </KpiCard>
        <KpiCard
          title="Current dues"
          icon={Wallet}
          to="/fees"
          tone={dues > 0 ? 'danger' : 'success'}
          loading={loading}
          footer={fines > 0 ? `Includes ${inr(fines)} late fine` : room ? `Rent ${inr(room.monthlyrent)}/month` : 'Nothing outstanding'}
        >
          <Stat value={Math.round(dues)} prefix="₹" />
        </KpiCard>
        <KpiCard
          title="Security deposit"
          icon={ShieldCheck}
          to="/fees"
          tone="success"
          loading={loading}
          footer={deposit ? (deposit.paymentstatus.toUpperCase() === 'PAID' ? 'Held, refunded when you vacate' : `${inr(deposit.balance)} still to pay`) : 'Raised when you get a room'}
        >
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{deposit ? inr(deposit.amountdue) : '—'}</span>
        </KpiCard>
        <KpiCard title="Latest leave" icon={DoorOpen} to="/leaves" tone="warning" loading={loading} footer={latestLeave ? `${latestLeave.startdate} → ${latestLeave.enddate}` : 'No requests yet'}>
          {latestLeave ? <Badge status={latestLeave.status} /> : <span className="text-3xl font-semibold">—</span>}
        </KpiCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="size-4 text-muted-foreground" aria-hidden="true" /> Today's menu
            </CardTitle>
            <CardDescription>{todayName()}{pref ? ` · your preference: ${pref}` : ''}</CardDescription>
            <CardAction>
              <Button asChild size="sm" variant="ghost">
                <Link to="/food-menu">
                  Full week <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>{loading ? <ListSkeleton rows={1} /> : today ? <TodayMenu day={today} pref={pref} /> : <EmptyNote>No menu published yet.</EmptyNote>}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notices</CardTitle>
            <CardAction>
              <Button asChild size="sm" variant="ghost">
                <Link to="/notices">
                  All <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>{loading ? <ListSkeleton rows={2} /> : notices.length ? <NoticeList items={notices.slice(0, 2)} /> : <EmptyNote>No notices.</EmptyNote>}</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Bills due</CardTitle>
            <CardAction>
              <Button asChild size="sm" variant={dues > 0 ? 'default' : 'ghost'}>
                <Link to="/fees">
                  {dues > 0 ? 'Pay now' : 'Fees'} <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ListSkeleton rows={2} />
            ) : unpaid.length === 0 ? (
              <EmptyNote>All paid up.</EmptyNote>
            ) : (
              <ul className="divide-y rounded-lg border">
                {unpaid.map((f) => (
                  <li key={f.feeid} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{billLabel(f)}</div>
                      <div className="text-xs text-muted-foreground">
                        Due {f.duedate}
                        {f.latefine > 0 && <span className="text-red-700"> · fine {inr(f.latefine)}</span>}
                      </div>
                    </div>
                    <span className="shrink-0 font-medium tabular-nums">{inr(f.balance)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maintenance</CardTitle>
            <CardDescription>{openRepairs.length ? `${openRepairs.length} open` : 'Nothing open'}</CardDescription>
            <CardAction>
              <Button asChild size="sm" variant="outline">
                <Link to="/maintenance">
                  <Plus /> Report
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ListSkeleton rows={2} />
            ) : repairs.length === 0 ? (
              <EmptyNote>No repair requests.</EmptyNote>
            ) : (
              <ul className="space-y-2">
                {repairs.slice(0, 3).map((r) => (
                  <li key={r.requestid} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <span className="truncate font-medium">{r.category}</span>
                    <Badge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Snowflake className="size-4 text-sky-600" aria-hidden="true" /> AC
            </CardTitle>
            <CardDescription>Electricity for AC is billed separately, split among roommates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!room ? (
              <EmptyNote>No room allocated.</EmptyNote>
            ) : room.acstatus === 'Active' ? (
              <>
                <p>AC is active in your room.</p>
                {fees
                  .filter((f) => f.billtype === 'AC')
                  .slice(0, 2)
                  .map((f) => (
                    <div key={f.feeid} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <span>{billLabel(f)}</span>
                      <span className="flex items-center gap-2 tabular-nums">
                        {inr(f.amountdue)} <Badge status={f.paymentstatus} />
                      </span>
                    </div>
                  ))}
              </>
            ) : room.acstatus === 'Requested' ? (
              <p className="flex items-center gap-2">
                <Badge status="REQUESTED" /> Waiting for the admin to approve and install.
              </p>
            ) : (
              <>
                <p className="text-muted-foreground">Your room doesn't have AC.</p>
                <Button size="sm" variant="outline" onClick={requestAc} disabled={requestingAc}>
                  Request AC for room {room.roomnumber}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
