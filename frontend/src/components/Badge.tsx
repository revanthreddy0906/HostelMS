/**
 * Generic status pill. Pass the raw status string from the backend (e.g. "Pending",
 * "IN_PROGRESS", "OVERDUE") and it will be normalized and colored consistently
 * across every status vocabulary in the app: leave/change-request, complaint,
 * fee, allocation, attendance, and login-account status.
 */
const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  // generic
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  // complaints
  OPEN: 'warning',
  'IN PROGRESS': 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  // fees
  PAID: 'success',
  OVERDUE: 'danger',
  // allocations
  ACTIVE: 'success',
  VACATED: 'neutral',
  TRANSFERRED: 'info',
  // attendance
  PRESENT: 'success',
  ABSENT: 'danger',
  'ON LEAVE': 'info',
  // login
  INACTIVE: 'neutral',
  LOCKED: 'danger',
  // hostel maintenance
  OPERATIONAL: 'success',
  MAINTENANCE: 'warning',
  SHUTDOWN: 'danger',
  OVERSTAYING: 'danger',
  'ON PREMISES': 'info',
};

const TONE_CLASSES: Record<string, string> = {
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  danger: 'bg-danger-100 text-danger-700',
  info: 'bg-info-100 text-info-700',
  neutral: 'bg-neutral-100 text-neutral-600',
};

export function Badge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-neutral-400">—</span>;
  const key = status.replace(/_/g, ' ').toUpperCase();
  const tone = STATUS_TONE[key] ?? 'neutral';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
