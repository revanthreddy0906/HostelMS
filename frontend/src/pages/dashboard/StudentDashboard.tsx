import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BedDouble, DoorOpen, MessageSquareWarning, Plus, Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { allocationsApi, complaintsApi, feesApi, hostelsApi, leavesApi, roomsApi, studentsApi } from '@/api/endpoints';
import type { Allocation, Complaint, Fee, Hostel, Leave, Room, Student } from '@/types';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardHeader, EmptyNote, KpiCard, ListSkeleton, Stat } from './shared';
import { serverTime } from '@/lib/time';

const OPEN_STATUSES = new Set(['OPEN', 'IN PROGRESS']);
const inr = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
const balanceOf = (f: Fee) => Number(f.amountdue) - Number(f.amountpaid);

export function StudentDashboard() {
  const { user } = useAuth();
  const { showError } = useToast();
  const [me, setMe] = useState<Student | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [allocation, setAllocation] = useState<Allocation | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [loading, setLoading] = useState(true);

  const studentId = user?.entity_id ?? null;

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [profile, f, l, c, a] = await Promise.all([
          studentsApi.me(),
          feesApi.me(),
          leavesApi.me(),
          complaintsApi.me(),
          allocationsApi.forStudent(studentId),
        ]);
        setMe(profile);
        setFees(f);
        setLeaves(l);
        setComplaints(c);
        setAllocation(a);
        if (a) {
          // Room and block names are a nicety; fall back to the room id if they can't be loaded.
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

  const unpaid = fees.filter((f) => f.paymentstatus.toUpperCase() !== 'PAID');
  const totalDue = unpaid.reduce((sum, f) => sum + balanceOf(f), 0);
  const nextDue = [...unpaid].sort((a, b) => a.duedate.localeCompare(b.duedate))[0];
  const recentLeaves = [...leaves].sort((a, b) => b.leaveid - a.leaveid);
  const latestLeave = recentLeaves[0];
  const openComplaints = complaints.filter((c) => OPEN_STATUSES.has(c.status.toUpperCase()));

  return (
    <div className="space-y-6">
      <DashboardHeader title={me ? `Welcome, ${me.firstname}` : 'My dashboard'} subtitle="Your room, fees and requests" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="My room"
          icon={BedDouble}
          loading={loading}
          footer={allocation ? `${hostel?.hostelname ?? 'Allocated'} · since ${allocation.allocationdate}` : 'Not allocated yet'}
        >
          <span className="text-3xl font-semibold tracking-tight">
            {allocation ? (room ? room.roomnumber : `#${allocation.roomid}`) : '—'}
          </span>
          {room && <span className="ml-2 text-sm text-muted-foreground">{room.roomtype}</span>}
        </KpiCard>
        <KpiCard
          title="Fees due"
          icon={Wallet}
          to="/fees"
          tone={totalDue > 0 ? 'danger' : 'success'}
          loading={loading}
          footer={nextDue ? `Next due ${nextDue.duedate}` : 'Nothing outstanding'}
        >
          <Stat value={totalDue} prefix="₹" />
        </KpiCard>
        <KpiCard
          title="Latest leave"
          icon={DoorOpen}
          to="/leaves"
          tone="warning"
          loading={loading}
          footer={latestLeave ? `${latestLeave.startdate} → ${latestLeave.enddate}` : 'No requests yet'}
        >
          {latestLeave ? <Badge status={latestLeave.status} /> : <span className="text-3xl font-semibold">—</span>}
        </KpiCard>
        <KpiCard
          title="Open complaints"
          icon={MessageSquareWarning}
          to="/complaints"
          tone="warning"
          loading={loading}
          footer={`${complaints.length} raised in total`}
        >
          <Stat value={openComplaints.length} />
        </KpiCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Fees</CardTitle>
            <CardDescription>Bills and payments for your room</CardDescription>
            <CardAction>
              <Button asChild size="sm" variant={totalDue > 0 ? 'default' : 'ghost'}>
                <Link to="/fees">
                  {totalDue > 0 ? 'Pay now' : 'View'} <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ListSkeleton rows={2} />
            ) : fees.length === 0 ? (
              <EmptyNote>No fee bills yet.</EmptyNote>
            ) : (
              <ul className="divide-y rounded-lg border">
                {fees.map((f) => (
                  <li key={f.feeid} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium tabular-nums">₹{inr(Number(f.amountdue))}</div>
                      <div className="text-xs text-muted-foreground">
                        Due {f.duedate}
                        {Number(f.amountpaid) > 0 && ` · ₹${inr(Number(f.amountpaid))} paid`}
                      </div>
                    </div>
                    <Badge status={f.paymentstatus} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leave requests</CardTitle>
            <CardDescription>Approved requests include a gate pass</CardDescription>
            <CardAction>
              <Button asChild size="sm" variant="outline">
                <Link to="/leaves">
                  <Plus /> Apply
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ListSkeleton rows={2} />
            ) : recentLeaves.length === 0 ? (
              <EmptyNote>You haven't applied for leave yet.</EmptyNote>
            ) : (
              <ul className="divide-y rounded-lg border">
                {recentLeaves.slice(0, 4).map((l) => (
                  <li key={l.leaveid} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {l.startdate} → {l.enddate}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {l.reason}
                        {l.gatepasscode && ' · Gate pass ready'}
                      </div>
                    </div>
                    <Badge status={l.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My complaints</CardTitle>
          <CardDescription>Maintenance and service issues you've reported</CardDescription>
          <CardAction>
            <Button asChild size="sm" variant="outline">
              <Link to="/complaints">
                <Plus /> Raise complaint
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ListSkeleton rows={2} />
          ) : complaints.length === 0 ? (
            <EmptyNote>No complaints raised.</EmptyNote>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {complaints.slice(0, 6).map((c) => (
                <li key={c.complaintid} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{c.category}</span>
                    <Badge status={c.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{serverTime(c.createdat).toLocaleDateString('en-IN')}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
