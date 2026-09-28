import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BedDouble,
  HeartHandshake,
  IndianRupee,
  MessageSquareWarning,
  Snowflake,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { useToast } from '@/context/ToastContext';
import { dashboardApi, leavesApi, studentsApi } from '@/api/endpoints';
import type { AdminSummary, Leave, Student } from '@/types';
import { periodLabel } from '@/lib/fees';
import { inr } from '@/components/FloorMap';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { DashboardHeader, EmptyNote, KpiCard, Stat } from './shared';

const PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

const occupancyConfig = {
  occupied: { label: 'Occupied', color: 'var(--chart-1)' },
  free: { label: 'Free', color: 'var(--chart-2)' },
} satisfies ChartConfig;
const revenueConfig = { amount: { label: 'Collected', color: 'var(--chart-4)' } } satisfies ChartConfig;
const valueConfig = { value: { label: 'Count', color: 'var(--chart-1)' } } satisfies ChartConfig;

function ChartCard({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function AdminDashboard() {
  const { showError } = useToast();
  const [data, setData] = useState<AdminSummary | null>(null);
  const [pendingLeaves, setPendingLeaves] = useState<Leave[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [d, l, s] = await Promise.all([dashboardApi.admin(), leavesApi.pending(), studentsApi.list()]);
        setData(d);
        setPendingLeaves(l);
        setStudents(s);
      } catch (err) {
        showError(err, 'Failed to load dashboard data.');
      }
    })();
  }, [showError]);

  const loading = !data;
  const c = data?.counts;
  const occPct = c && c.total_beds ? Math.round(((c.total_beds - c.available_beds) / c.total_beds) * 100) : 0;
  const nameOf = (id: number) => {
    const s = students.find((x) => x.studentid === id);
    return s ? `${s.firstname} ${s.lastname}` : `Student #${id}`;
  };

  return (
    <div className="space-y-6">
      <DashboardHeader title="Dashboard" subtitle="Hostel overview" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Active students" icon={Users} to="/allocations" loading={loading} footer={c ? `${c.vacated_students} vacated · ${c.awaiting_room} awaiting a room` : ''}>
          <Stat value={c?.active_students ?? 0} />
        </KpiCard>
        <KpiCard title="Occupancy" icon={BedDouble} to="/hostels" loading={loading} footer={c ? `${c.available_beds} of ${c.total_beds} beds free · ${c.occupied_rooms}/${c.total_rooms} rooms in use` : ''}>
          <Stat value={occPct} suffix="%" />
          <Progress value={occPct} className="h-1.5" aria-label="Bed occupancy" />
        </KpiCard>
        <KpiCard title="Collected this month" icon={IndianRupee} to="/fees" tone="success" loading={loading} footer="Rent, deposits and AC">
          <Stat value={Math.round(c?.revenue_this_month ?? 0)} prefix="₹" />
        </KpiCard>
        <KpiCard title="Pending fees" icon={Wallet} to="/fees" tone="danger" loading={loading} footer="Rent and AC incl. late fines">
          <Stat value={Math.round(c?.pending_fees ?? 0)} prefix="₹" />
        </KpiCard>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Open maintenance', value: c?.open_maintenance, icon: Wrench, to: '/maintenance' },
          { label: 'Open complaints', value: c?.open_complaints, icon: MessageSquareWarning, to: '/complaints' },
          { label: 'AC bills unpaid', value: c?.ac_bills_pending, icon: Snowflake, to: '/ac-billing' },
          { label: 'Parent rooms in use', value: c ? `${c.parent_rooms_occupied}/${c.parent_rooms}` : undefined, icon: HeartHandshake, to: '/parents' },
        ].map((t) => (
          <Link key={t.label} to={t.to} className="flex items-center gap-3 rounded-lg border bg-background p-3 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <t.icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold tabular-nums leading-tight">{t.value ?? '…'}</span>
              <span className="block truncate text-xs text-muted-foreground">{t.label}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Occupancy by floor" description="Occupied and free beds on each floor" className="lg:col-span-2">
          {!data ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ChartContainer config={occupancyConfig} className="h-64 w-full">
              <BarChart data={data.occupancy_by_floor}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="occupied" stackId="b" fill="var(--color-occupied)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="free" stackId="b" fill="var(--color-free)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>Leave requests awaiting a decision</CardDescription>
            <CardAction>
              <Button asChild size="sm" variant="ghost">
                <Link to="/leaves">
                  All <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {pendingLeaves.length === 0 ? (
              <EmptyNote>No pending leave requests.</EmptyNote>
            ) : (
              <ul className="space-y-2">
                {pendingLeaves.slice(0, 5).map((l) => (
                  <li key={l.leaveid} className="rounded-md border bg-muted/40 px-3 py-2">
                    <div className="text-sm font-medium">{nameOf(l.studentid)}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.startdate} → {l.enddate} · {l.reason}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Monthly revenue" description="Payments received (excludes deposit settlements)">
          {!data ? (
            <Skeleton className="h-52 w-full" />
          ) : (
            <ChartContainer config={revenueConfig} className="h-52 w-full">
              <BarChart data={data.revenue_by_month.map((r) => ({ ...r, label: periodLabel(r.month).split(' ')[0].slice(0, 3) }))}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => inr(Number(v))} />} />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </ChartCard>

        <ChartCard title="Students by sharing type">
          {!data ? (
            <Skeleton className="h-52 w-full" />
          ) : data.students_by_sharing.length === 0 ? (
            <EmptyNote>No students housed.</EmptyNote>
          ) : (
            <ChartContainer
              config={Object.fromEntries(data.students_by_sharing.map((s, i) => [s.label, { label: s.label, color: PALETTE[i % PALETTE.length] }]))}
              className="h-52 w-full"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="label" hideLabel />} />
                <Pie data={data.students_by_sharing} dataKey="value" nameKey="label" innerRadius={45} outerRadius={75} strokeWidth={2}>
                  {data.students_by_sharing.map((s, i) => (
                    <Cell key={s.label} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="label" />} />
              </PieChart>
            </ChartContainer>
          )}
        </ChartCard>

        <ChartCard title="Complaints by category">
          {!data ? (
            <Skeleton className="h-52 w-full" />
          ) : data.complaints_by_category.length === 0 ? (
            <EmptyNote>No complaints yet.</EmptyNote>
          ) : (
            <ChartContainer config={valueConfig} className="h-52 w-full">
              <BarChart data={data.complaints_by_category} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={96} fontSize={11} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Maintenance by status">
        {!data ? (
          <Skeleton className="h-10 w-full" />
        ) : data.maintenance_by_status.length === 0 ? (
          <EmptyNote>No maintenance requests.</EmptyNote>
        ) : (
          <div className="flex flex-wrap gap-3">
            {data.maintenance_by_status.map((m) => (
              <Link key={m.label} to="/maintenance" className="rounded-lg border px-4 py-2 transition-shadow hover:shadow-md">
                <div className="text-xl font-semibold tabular-nums">{m.value}</div>
                <div className="text-xs text-muted-foreground">{m.label}</div>
              </Link>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
