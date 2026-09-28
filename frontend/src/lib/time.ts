/** Backend timestamps are naive UTC (datetime.utcnow); mark them as UTC so the browser shows local time. */
export function serverTime(iso: string): Date {
  return new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : `${iso}Z`);
}
