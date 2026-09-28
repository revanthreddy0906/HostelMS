import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'motion/react';
import { ArrowRight, BedDouble, BedSingle, DoorOpen, MessageSquareWarning, type LucideIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useToast } from '@/context/ToastContext';
import { complaintsApi, leavesApi, roomsApi, studentsApi } from '@/api/endpoints';
import type { Complaint, Leave, OccupancyRow, Student } from '@/types';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { NumberTicker } from '@/components/ui/number-ticker';
import { BorderBeam } from '@/components/ui/border-beam';

const OPEN_STATUSES = new Set(['OPEN', 'IN PROGRESS']);

const chartConfig = {
  occupied: { label: 'Occupied', color: 'var(--chart-1)' },
  free: { label: 'Free', color: 'var(--chart-2)' },
} satisfies ChartConfig;

function Stat({ value, reduceMotion, suffix = '' }: { value: number; reduceMotion: boolean; suffix?: string }) {
  return (
    <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
      {reduceMotion ? value : <NumberTicker value={value} className="tracking-tight text-foreground" />}
      {suffix}
    </span>
  );
}

function KpiCard({
  title,
  icon: Icon,
  to,
  loading,
  children,
  footer,
}: {
  title: string;
  icon: LucideIcon;
  to: string;
  loading: boolean;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Link to={to} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full gap-3 transition-shadow duration-150 ease-out group-hover:shadow-md">
        <CardHeader>
          <CardDescription className="font-medium text-muted-foreground">{title}</CardDescription>
          <CardAction>
            <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </span>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? <Skeleton className="h-9 w-20" /> : children}
          <div className="text-xs text-muted-foreground">{loading ? <Skeleton className="h-3 w-32" /> : footer}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function AdminDashboard() {
  const { showError } = useToast();
  const reduceMotion = !!useReducedMotion();
  const [occupancy, setOccupancy] = useState<OccupancyRow[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<Leave[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rooms, c, l, s] = await Promise.all([
          roomsApi.occupancy(),
          complaintsApi.list(),
          leavesApi.pending(),
          studentsApi.list(),
        ]);
        setOccupancy(rooms);
        setComplaints(c);
        setPendingLeaves(l);
        setStudents(s);
      } catch (err) {
        showError(err, 'Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [showError]);

  const totals = useMemo(() => {
    const capacity = occupancy.reduce((sum, r) => sum + r.capacity, 0);
    const occupied = occupancy.reduce((sum, r) => sum + r.occupied, 0);
    return { capacity, occupied, free: capacity - occupied, pct: capacity ? Math.round((occupied / capacity) * 100) : 0 };
  }, [occupancy]);

  const byHostel = useMemo(() => {
    const map = new Map<string, { hostel: string; occupied: number; free: number; rooms: OccupancyRow[] }>();
    for (const r of occupancy) {
      const entry = map.get(r.hostel) ?? { hostel: r.hostel, occupied: 0, free: 0, rooms: [] };
      entry.occupied += r.occupied;
      entry.free += r.capacity - r.occupied;
      entry.rooms.push(r);
      map.set(r.hostel, entry);
    }
    return [...map.values()];
  }, [occupancy]);

  const openComplaints = complaints.filter((c) => OPEN_STATUSES.has(c.status.toUpperCase()));
  const complaintsByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of openComplaints) counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [openComplaints]);

  const studentName = (id: number) => {
    const s = students.find((st) => st.studentid === id);
    return s ? `${s.firstname} ${s.lastname}` : `Student #${id}`;
  };

  const needsAttention = pendingLeaves.length + openComplaints.length;
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6">
      <div className="animate-in fade-in duration-300">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Institution-wide overview · {today}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Occupancy"
          icon={BedDouble}
          to="/hostels"
          loading={loading}
          footer={`${totals.occupied} of ${totals.capacity} beds occupied`}
        >
          <Stat value={totals.pct} suffix="%" reduceMotion={reduceMotion} />
          <Progress value={totals.pct} className="h-1.5" aria-label="Bed occupancy" />
        </KpiCard>
        <KpiCard title="Beds available" icon={BedSingle} to="/allocations" loading={loading} footer="Ready for allocation">
          <Stat value={totals.free} reduceMotion={reduceMotion} />
        </KpiCard>
        <KpiCard
          title="Open complaints"
          icon={MessageSquareWarning}
          to="/complaints"
          loading={loading}
          footer={`${complaints.length} logged in total`}
        >
          <Stat value={openComplaints.length} reduceMotion={reduceMotion} />
        </KpiCard>
        <KpiCard title="Pending leaves" icon={DoorOpen} to="/leaves" loading={loading} footer="Awaiting warden decision">
          <Stat value={pendingLeaves.length} reduceMotion={reduceMotion} />
        </KpiCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Occupancy by hostel</CardTitle>
            <CardDescription>Occupied and free beds in each block</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : byHostel.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No hostels configured yet.</p>
            ) : (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <BarChart data={byHostel} barCategoryGap="30%">
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="hostel" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="occupied" stackId="beds" fill="var(--color-occupied)" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="free" stackId="beds" fill="var(--color-free)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          {!loading && needsAttention > 0 && !reduceMotion && (
            <BorderBeam size={90} duration={8} colorFrom="#818cf8" colorTo="#4f46e5" />
          )}
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>
              {loading ? 'Checking…' : needsAttention === 0 ? 'All caught up' : `${needsAttention} items waiting`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <section>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Leave requests</h3>
                  {pendingLeaves.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pending requests.</p>
                  ) : (
                    <ul className="space-y-2">
                      {pendingLeaves.slice(0, 3).map((l) => (
                        <li key={l.leaveid} className="rounded-md border bg-muted/40 px-3 py-2">
                          <div className="text-sm font-medium">{studentName(l.studentid)}</div>
                          <div className="text-xs text-muted-foreground">
                            {l.startdate} → {l.enddate} · {l.reason}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Open complaints</h3>
                  {complaintsByCategory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No open complaints.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {complaintsByCategory.map(([category, count]) => (
                        <li key={category} className="flex items-center justify-between text-sm">
                          <span>{category}</span>
                          <span className="tabular-nums text-muted-foreground">{count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link to="/leaves">
                      Leaves <ArrowRight />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link to="/complaints">
                      Complaints <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rooms</CardTitle>
          <CardDescription>Bed usage per room</CardDescription>
          <CardAction>
            <Button asChild size="sm" variant="ghost">
              <Link to="/hostels">
                Manage <ArrowRight />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : byHostel.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No rooms yet.</p>
          ) : (
            <div className="space-y-6">
              {byHostel.map((h) => (
                <div key={h.hostel}>
                  <h3 className="mb-3 text-sm font-medium">{h.hostel}</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {h.rooms.map((r) => {
                      const pct = r.capacity ? Math.round((r.occupied / r.capacity) * 100) : 0;
                      return (
                        <div key={r.room} className="rounded-lg border p-3">
                          <div className="flex items-baseline justify-between">
                            <span className="text-sm font-medium">Room {r.room}</span>
                            <span className="text-xs text-muted-foreground">{r.type}</span>
                          </div>
                          <Progress value={pct} className="mt-2.5 h-1.5" aria-label={`Room ${r.room} occupancy`} />
                          <div className="mt-1.5 text-xs tabular-nums text-muted-foreground">
                            {r.occupied}/{r.capacity} beds
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
