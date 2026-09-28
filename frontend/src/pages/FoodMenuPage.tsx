import { useEffect, useState } from 'react';
import { Coffee, Moon, Pencil, Sun, type LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { EmptyState, LoadingState } from '../components/Feedback';
import { menuApi, studentsApi } from '../api/endpoints';
import type { MenuDay } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const todayName = () => WEEKDAYS[(new Date().getDay() + 6) % 7];

type Pref = 'Veg' | 'Non-Veg' | null;

/** One meal with its veg and optional non-veg option; highlights the viewer's preference. */
export function MealLine({ veg, nonveg, pref }: { veg: string; nonveg?: string | null; pref: Pref }) {
  if (!nonveg) return <span>{veg}</span>;
  return (
    <span className="space-y-0.5">
      <span className={cn('block', pref === 'Non-Veg' && 'text-muted-foreground')}>
        <span className="mr-1 inline-block size-2 rounded-sm border border-emerald-600 align-middle" aria-hidden="true" />
        {veg}
      </span>
      <span className={cn('block', pref === 'Veg' && 'text-muted-foreground')}>
        <span className="mr-1 inline-block size-2 rounded-sm border border-red-600 bg-red-600 align-middle" aria-hidden="true" />
        {nonveg}
      </span>
    </span>
  );
}

export function TodayMenu({ day, pref, compact = false }: { day: MenuDay; pref: Pref; compact?: boolean }) {
  const meals: { label: string; icon: LucideIcon; veg: string; nonveg?: string | null }[] = [
    { label: 'Breakfast', icon: Coffee, veg: day.breakfast },
    { label: 'Lunch', icon: Sun, veg: day.lunch, nonveg: day.lunchnonveg },
    { label: 'Dinner', icon: Moon, veg: day.dinner, nonveg: day.dinnernonveg },
  ];
  return (
    <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3')}>
      {meals.map(({ label, icon: Icon, veg, nonveg }) => (
        <div key={label} className="rounded-lg border bg-background p-3 text-sm">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Icon className="size-3.5" aria-hidden="true" /> {label}
            {label === 'Lunch' && day.fryums && <span className="ml-auto rounded-full bg-amber-100 px-1.5 text-[11px] text-amber-800">+ Fryums</span>}
          </div>
          <MealLine veg={veg} nonveg={nonveg} pref={pref} />
        </div>
      ))}
    </div>
  );
}

export function FoodMenuPage() {
  const { user } = useAuth();
  const canEdit = user?.role === 'Admin' || user?.role === 'Warden';
  const { showToast, showError } = useToast();
  const [week, setWeek] = useState<MenuDay[]>([]);
  const [pref, setPref] = useState<Pref>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MenuDay[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setWeek(await menuApi.week());
        if (user?.role === 'Student') setPref(((await studentsApi.me()).foodpreference as Pref) ?? null);
      } catch (err) {
        showError(err, 'Failed to load the menu.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.role, showError]);

  const today = todayName();
  const todayRow = week.find((d) => d.day === today);
  const fryumsCount = editing?.filter((d) => d.fryums).length ?? 0;

  function openEdit() {
    const byDay = new Map(week.map((d) => [d.day, d]));
    setEditing(WEEKDAYS.map((day) => ({ ...(byDay.get(day) ?? { day, breakfast: '', lunch: '', dinner: '', fryums: false }) })));
  }

  function patch(day: string, values: Partial<MenuDay>) {
    setEditing((rows) => rows?.map((r) => (r.day === day ? { ...r, ...values } : r)) ?? null);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      setWeek(await menuApi.save(editing));
      showToast('Weekly menu saved.', 'success');
      setEditing(null);
    } catch (err) {
      showError(err, 'Failed to save the menu.');
    } finally {
      setSaving(false);
    }
  }

  const incomplete = editing?.some((d) => !d.breakfast.trim() || !d.lunch.trim() || !d.dinner.trim()) ?? true;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Food menu"
        subtitle={pref ? `Your preference: ${pref}. Both options are shown.` : 'Weekly mess menu'}
        actions={
          canEdit ? (
            <Button onClick={openEdit} disabled={loading}>
              <Pencil /> Edit week
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <LoadingState />
      ) : week.length === 0 ? (
        <Card>
          <EmptyState title="No menu yet" hint={canEdit ? 'Set up the weekly menu with Edit week.' : 'The warden will publish the menu soon.'} />
        </Card>
      ) : (
        <>
          {todayRow && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle>Today · {today}</CardTitle>
                <CardDescription>{todayRow.fryums ? 'Fryums with lunch today.' : 'What’s being served today.'}</CardDescription>
              </CardHeader>
              <CardContent>
                <TodayMenu day={todayRow} pref={pref} />
              </CardContent>
            </Card>
          )}

          <div className="overflow-x-auto rounded-lg border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Day</th>
                  <th className="px-4 py-2.5 font-medium">Breakfast</th>
                  <th className="px-4 py-2.5 font-medium">Lunch</th>
                  <th className="px-4 py-2.5 font-medium">Dinner</th>
                </tr>
              </thead>
              <tbody>
                {week.map((d) => (
                  <tr key={d.day} className={cn('border-t align-top', d.day === today && 'bg-primary/5')}>
                    <th scope="row" className="px-4 py-3 text-left font-medium">
                      {d.day}
                      {d.day === today && <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">Today</span>}
                    </th>
                    <td className="px-4 py-3">{d.breakfast}</td>
                    <td className="px-4 py-3">
                      <MealLine veg={d.lunch} nonveg={d.lunchnonveg} pref={pref} />
                      {d.fryums && <span className="mt-1 inline-block rounded-full bg-amber-100 px-1.5 text-[11px] text-amber-800">+ Fryums</span>}
                    </td>
                    <td className="px-4 py-3">
                      <MealLine veg={d.dinner} nonveg={d.dinnernonveg} pref={pref} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-sm border border-emerald-600" /> Veg
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-sm border border-red-600 bg-red-600" /> Non-veg option
            </span>
            <span>Fryums are served twice a week.</span>
          </p>
        </>
      )}

      <Modal
        open={!!editing}
        title="Edit weekly menu"
        onClose={() => setEditing(null)}
        wide
        footer={
          <>
            <span className={cn('mr-auto self-center text-xs', fryumsCount === 2 ? 'text-muted-foreground' : 'text-destructive')}>
              Fryums on {fryumsCount} of 2 required days
            </span>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving} disabled={fryumsCount !== 2 || incomplete}>
              Save week
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {editing?.map((d) => (
            <fieldset key={d.day} className="rounded-lg border p-3">
              <legend className="flex items-center gap-3 px-1 text-sm font-medium">
                {d.day}
                <label className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                  <input type="checkbox" className="size-3.5 accent-[var(--primary)]" checked={d.fryums} onChange={(e) => patch(d.day, { fryums: e.target.checked })} />
                  Fryums
                </label>
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <MenuInput label="Breakfast" value={d.breakfast} onChange={(v) => patch(d.day, { breakfast: v })} className="sm:col-span-2" />
                <MenuInput label="Lunch (veg)" value={d.lunch} onChange={(v) => patch(d.day, { lunch: v })} />
                <MenuInput label="Lunch non-veg (optional)" value={d.lunchnonveg ?? ''} onChange={(v) => patch(d.day, { lunchnonveg: v || null })} />
                <MenuInput label="Dinner (veg)" value={d.dinner} onChange={(v) => patch(d.day, { dinner: v })} />
                <MenuInput label="Dinner non-veg (optional)" value={d.dinnernonveg ?? ''} onChange={(v) => patch(d.day, { dinnernonveg: v || null })} />
              </div>
            </fieldset>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function MenuInput({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={cn('space-y-1 text-xs text-muted-foreground', className)}>
      <span>{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-foreground" />
    </label>
  );
}
