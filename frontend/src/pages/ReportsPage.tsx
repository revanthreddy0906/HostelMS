import { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { downloadFile } from '../api/client';

interface ReportDef {
  key: string;
  title: string;
  description: string;
  path: string;
  filename: string;
}

const REPORTS: ReportDef[] = [
  {
    key: 'fee-pdf',
    title: 'Fee collection (PDF)',
    description: 'Summary of fee dues and payments across all students.',
    path: '/reports/fee-collection.pdf',
    filename: 'fee-collection.pdf',
  },
  {
    key: 'fee-xlsx',
    title: 'Fee collection (Excel)',
    description: 'Same data as a spreadsheet for further analysis.',
    path: '/reports/fee-collection.xlsx',
    filename: 'fee-collection.xlsx',
  },
  {
    key: 'occ-pdf',
    title: 'Occupancy report (PDF)',
    description: 'Room-by-room occupancy across all hostels.',
    path: '/reports/occupancy.pdf',
    filename: 'occupancy.pdf',
  },
  {
    key: 'occ-xlsx',
    title: 'Occupancy report (Excel)',
    description: 'Same data as a spreadsheet for further analysis.',
    path: '/reports/occupancy.xlsx',
    filename: 'occupancy.xlsx',
  },
  {
    key: 'leave-pdf',
    title: 'Leave log (PDF)',
    description: 'All leave applications and their approval status.',
    path: '/reports/leave-log.pdf',
    filename: 'leave-log.pdf',
  },
  {
    key: 'leave-xlsx',
    title: 'Leave log (Excel)',
    description: 'Same data as a spreadsheet for further analysis.',
    path: '/reports/leave-log.xlsx',
    filename: 'leave-log.xlsx',
  },
  {
    key: 'complaint-pdf',
    title: 'Complaint timeline (PDF)',
    description: 'Complaint history with status transitions.',
    path: '/reports/complaint-timeline.pdf',
    filename: 'complaint-timeline.pdf',
  },
  {
    key: 'complaint-xlsx',
    title: 'Complaint timeline (Excel)',
    description: 'Same data as a spreadsheet for further analysis.',
    path: '/reports/complaint-timeline.xlsx',
    filename: 'complaint-timeline.xlsx',
  },
];

export function ReportsPage() {
  const { showToast, showError } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);

  async function download(report: ReportDef) {
    setDownloading(report.key);
    try {
      await downloadFile(report.path, report.filename);
      showToast(`${report.title} downloaded.`, 'success');
    } catch (err) {
      showError(err, `Failed to download ${report.title}.`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <PageHeader title="Reports" subtitle="Download institutional reports as PDF or Excel" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <Card key={r.key} title={r.title}>
            <p className="mb-4 text-sm text-neutral-500">{r.description}</p>
            <Button onClick={() => download(r)} loading={downloading === r.key} variant="secondary">
              Download
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
