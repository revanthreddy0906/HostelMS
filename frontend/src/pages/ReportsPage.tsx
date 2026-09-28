import { useState } from 'react';
import { BedDouble, DoorOpen, FileSpreadsheet, FileText, MessageSquareWarning, Wallet, type LucideIcon } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { SelectField, TextField } from '../components/Form';
import { downloadFile } from '../api/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Period = 'month' | 'semester' | 'year' | 'custom';
type Format = 'pdf' | 'xlsx';

const pad = (n: number) => String(n).padStart(2, '0');
const lastDayOf = (y: number, m: number) => new Date(y, m, 0).getDate();

function rangeFor(period: Period, v: { month: string; year: number; half: '1' | '2'; start: string; end: string }) {
  if (period === 'month') {
    const [y, m] = v.month.split('-').map(Number);
    return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(lastDayOf(y, m))}`, label: v.month };
  }
  if (period === 'semester') {
    return v.half === '1'
      ? { start: `${v.year}-01-01`, end: `${v.year}-06-30`, label: `${v.year}-sem1` }
      : { start: `${v.year}-07-01`, end: `${v.year}-12-31`, label: `${v.year}-sem2` };
  }
  if (period === 'year') return { start: `${v.year}-01-01`, end: `${v.year}-12-31`, label: String(v.year) };
  return { start: v.start, end: v.end, label: `${v.start}_to_${v.end}` };
}

interface ReportDef {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  base: string;
}

const OTHER_REPORTS: ReportDef[] = [
  { key: 'occupancy', title: 'Daily occupancy', description: 'Room-by-room beds occupied and free across every block.', icon: BedDouble, base: 'occupancy' },
  { key: 'leave-log', title: 'Leave log', description: 'Every leave and out-pass request with its decision and gate movements.', icon: DoorOpen, base: 'leave-log' },
  {
    key: 'complaint-timeline',
    title: 'Complaint resolution timeline',
    description: 'Each complaint from registration to resolution, with time taken.',
    icon: MessageSquareWarning,
    base: 'complaint-timeline',
  },
];

function FormatButtons({ busyKey, keyPrefix, onDownload, disabled }: { busyKey: string | null; keyPrefix: string; onDownload: (f: Format) => void; disabled?: boolean }) {
  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" loading={busyKey === `${keyPrefix}-pdf`} disabled={disabled} onClick={() => onDownload('pdf')}>
        <FileText /> PDF
      </Button>
      <Button variant="secondary" size="sm" loading={busyKey === `${keyPrefix}-xlsx`} disabled={disabled} onClick={() => onDownload('xlsx')}>
        <FileSpreadsheet /> Excel
      </Button>
    </div>
  );
}

export function ReportsPage() {
  const { showToast, showError } = useToast();
  const now = new Date();
  const [busy, setBusy] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('month');
  const [month, setMonth] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`);
  const [year, setYear] = useState(now.getFullYear());
  const [half, setHalf] = useState<'1' | '2'>(now.getMonth() < 6 ? '1' : '2');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const range = rangeFor(period, { month, year, half, start, end });
  const rangeInvalid = period === 'custom' && (!start || !end || end < start);

  async function download(key: string, path: string, filename: string, title: string) {
    setBusy(key);
    try {
      await downloadFile(path, filename);
      showToast(`${title} downloaded.`, 'success');
    } catch (err) {
      showError(err, `Failed to download ${title}.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Download operational and financial reports as PDF or Excel" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-4 text-muted-foreground" aria-hidden="true" /> Fee collection
          </CardTitle>
          <CardDescription>Billed, collected and outstanding fees for a period.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList>
              <TabsTrigger value="month">Monthly</TabsTrigger>
              <TabsTrigger value="semester">Semester</TabsTrigger>
              <TabsTrigger value="year">Yearly</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid max-w-lg grid-cols-2 gap-x-4">
            {period === 'month' && <TextField label="Month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />}
            {(period === 'semester' || period === 'year') && (
              <SelectField label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))} options={years.map((y) => ({ value: y, label: String(y) }))} />
            )}
            {period === 'semester' && (
              <SelectField
                label="Semester"
                value={half}
                onChange={(e) => setHalf(e.target.value as '1' | '2')}
                options={[
                  { value: '1', label: 'January – June' },
                  { value: '2', label: 'July – December' },
                ]}
              />
            )}
            {period === 'custom' && (
              <>
                <TextField label="From" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                <TextField label="To" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} error={start && end && end < start ? 'Must be after the start date.' : undefined} />
              </>
            )}
          </div>
          {!rangeInvalid && (
            <p className="text-xs text-muted-foreground">
              Bills due {range.start} to {range.end}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <FormatButtons
            busyKey={busy}
            keyPrefix="fee"
            disabled={rangeInvalid}
            onDownload={(f) =>
              download(`fee-${f}`, `/reports/fee-collection.${f}?start=${range.start}&end=${range.end}`, `fee-collection-${range.label}.${f}`, 'Fee collection report')
            }
          />
        </CardFooter>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {OTHER_REPORTS.map((r) => (
          <Card key={r.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <r.icon className="size-4 text-muted-foreground" aria-hidden="true" /> {r.title}
              </CardTitle>
              <CardDescription>{r.description}</CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto">
              <FormatButtons busyKey={busy} keyPrefix={r.key} onDownload={(f) => download(`${r.key}-${f}`, `/reports/${r.base}.${f}`, `${r.base}.${f}`, `${r.title} report`)} />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
