import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface RowAction {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export function RowActions({ actions, label = 'Row actions' }: { actions: RowAction[]; label?: string }) {
  const normal = actions.filter((a) => !a.destructive);
  const destructive = actions.filter((a) => a.destructive);
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={label}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          {normal.map((a) => (
            <DropdownMenuItem key={a.label} onSelect={a.onSelect} disabled={a.disabled}>
              {a.icon && <a.icon />}
              {a.label}
            </DropdownMenuItem>
          ))}
          {normal.length > 0 && destructive.length > 0 && <DropdownMenuSeparator />}
          {destructive.map((a) => (
            <DropdownMenuItem key={a.label} variant="destructive" onSelect={a.onSelect} disabled={a.disabled}>
              {a.icon && <a.icon />}
              {a.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
