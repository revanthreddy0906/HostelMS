import { Snowflake, Users } from 'lucide-react';
import type { MapHostel, MapRoom } from '@/types';
import { cn } from '@/lib/utils';

export const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function BedDots({ room, size = 'md' }: { room: MapRoom; size?: 'sm' | 'md' }) {
  const taken = room.beds.filter((b) => b.studentid).length;
  return (
    <div
      className="flex flex-wrap gap-1"
      role="img"
      aria-label={room.purpose === 'Parent' ? `${room.capacity} guest beds` : `${taken} of ${room.capacity} beds occupied`}
    >
      {room.beds.map((b) => (
        <span
          key={b.bedid}
          title={b.studentname ? `Bed ${b.bednumber}: ${b.studentname}` : `Bed ${b.bednumber}: free`}
          className={cn(
            'rounded-full border-2',
            size === 'sm' ? 'size-2.5' : 'size-3.5',
            b.studentid ? 'border-primary bg-primary' : room.purpose === 'Parent' ? 'border-amber-500' : 'border-muted-foreground/40',
          )}
        />
      ))}
    </div>
  );
}

function RoomCard({ room, onSelect, selectable }: { room: MapRoom; onSelect?: (r: MapRoom) => void; selectable?: (r: MapRoom) => boolean }) {
  const full = room.occupiedbeds >= room.capacity;
  const isParent = room.purpose === 'Parent';
  const disabled = selectable ? !selectable(room) : false;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-muted-foreground">Room</div>
          <div className="text-base font-semibold tabular-nums leading-tight">{room.roomnumber}</div>
        </div>
        {room.acstatus === 'Active' && <Snowflake className="size-4 text-sky-600" aria-label="AC room" />}
      </div>
      <div className={cn('text-xs font-medium', isParent ? 'text-amber-700' : 'text-muted-foreground')}>
        {isParent ? 'Parent room' : room.roomtype}
      </div>
      <BedDots room={room} />
      <div className="flex items-baseline justify-between text-xs">
        <span className={cn('font-medium tabular-nums', isParent ? 'text-amber-700' : '')}>{isParent ? 'Free stay' : inr(room.monthlyrent)}</span>
        <span className="text-muted-foreground tabular-nums">
          {isParent ? `${room.capacity} beds` : full ? 'Full' : `${room.capacity - room.occupiedbeds} free`}
        </span>
      </div>
    </>
  );
  const className = cn(
    'flex flex-col gap-2 rounded-lg border bg-background p-3 text-left transition-shadow duration-150 ease-out',
    isParent && 'border-amber-200 bg-amber-50/50',
    full && !isParent && 'bg-muted/40',
  );
  if (!onSelect) return <div className={className}>{body}</div>;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(room)}
      className={cn(
        className,
        'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:shadow-none',
      )}
    >
      {body}
    </button>
  );
}

export function FloorMap({
  hostel,
  onSelectRoom,
  selectable,
}: {
  hostel: MapHostel;
  onSelectRoom?: (room: MapRoom) => void;
  selectable?: (room: MapRoom) => boolean;
}) {
  if (hostel.floors.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No rooms in this block yet.</p>;
  }
  return (
    <div className="space-y-6">
      {hostel.floors.map(({ floor, rooms }) => {
        const studentRooms = rooms.filter((r) => r.purpose === 'Student');
        const beds = studentRooms.reduce((n, r) => n + r.capacity, 0);
        const taken = studentRooms.reduce((n, r) => n + r.occupiedbeds, 0);
        return (
          <section key={floor}>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">FLOOR {String(floor).padStart(2, '0')}</h3>
              {beds > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                  <Users className="size-3.5" aria-hidden="true" /> {taken}/{beds} beds
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {rooms.map((room) => (
                <RoomCard key={room.roomid} room={room} onSelect={onSelectRoom} selectable={selectable} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-full border-2 border-primary bg-primary" /> Occupied
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-full border-2 border-muted-foreground/40" /> Free bed
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-full border-2 border-amber-500" /> Parent room
      </span>
      <span className="flex items-center gap-1.5">
        <Snowflake className="size-3.5 text-sky-600" /> AC
      </span>
    </div>
  );
}
