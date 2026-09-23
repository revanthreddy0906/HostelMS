import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Button } from './Button';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';

interface NavItem {
  to: string;
  label: string;
  roles: Role[];
  icon: ReactNode;
}

/* 20x20 stroke icons, hand-drawn to keep the bundle dependency-free. */
const icon = (d: string) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
    <path d={d} />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', roles: ['Admin', 'Warden', 'Staff', 'Student'], icon: icon('M3 3h6v6H3zM11 3h6v4h-6zM11 9h6v8h-6zM3 11h6v6H3z') },
  { to: '/students', label: 'Students', roles: ['Admin', 'Student'], icon: icon('M10 10a3 3 0 100-6 3 3 0 000 6zM4 17a6 6 0 0112 0') },
  { to: '/hostels', label: 'Hostels & Rooms', roles: ['Admin', 'Warden'], icon: icon('M3 17V8l7-5 7 5v9M3 17h14M8 17v-5h4v5') },
  { to: '/allocations', label: 'Allocations', roles: ['Admin', 'Warden'], icon: icon('M3 14V8h14v6M3 11h14M3 14v3M17 14v3M6 8V5h4v3') },
  { to: '/fees', label: 'Fees', roles: ['Admin', 'Student'], icon: icon('M3 5h14v10H3zM3 8h14M6 12h3') },
  { to: '/complaints', label: 'Complaints', roles: ['Admin', 'Warden', 'Staff', 'Student'], icon: icon('M4 4h12v9H9l-4 3v-3H4z') },
  { to: '/visitors', label: 'Visitors', roles: ['Admin', 'Warden', 'Staff'], icon: icon('M4 3h12v14H4zM8 8a2 2 0 104 0 2 2 0 00-4 0M7 14a3 3 0 016 0') },
  { to: '/attendance', label: 'Attendance', roles: ['Admin', 'Warden', 'Staff'], icon: icon('M4 4h12v13H4zM4 8h12M7 2v4M13 2v4M7 12l2 2 4-4') },
  { to: '/leaves', label: 'Leaves & Gate Pass', roles: ['Admin', 'Warden', 'Staff', 'Student'], icon: icon('M10 3v11M6 10l4 4 4-4M4 17h12') },
  { to: '/reports', label: 'Reports', roles: ['Admin', 'Warden'], icon: icon('M4 17V9M10 17V4M16 17v-6') },
  { to: '/staff', label: 'Staff', roles: ['Admin'], icon: icon('M7 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM2 16a5 5 0 0110 0M14 9a2 2 0 100-4M14 11a4 4 0 014 4') },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const initial = user.username.charAt(0).toUpperCase();

  return (
    <aside className="flex h-full min-h-0 w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-neutral-200 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-sm font-semibold text-white">
          H
        </div>
        <div className="text-sm font-semibold text-neutral-900">Hostel MS</div>
      </div>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Main">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${
                isActive
                  ? 'bg-primary-50 text-primary-700 before:absolute before:inset-y-1.5 before:-left-3 before:w-0.5 before:rounded-r-full before:bg-primary-600'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`
            }
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="shrink-0 border-t border-neutral-200 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-neutral-900">{user.username}</div>
            <div className="truncate text-xs text-neutral-500">{user.role}</div>
          </div>
        </div>
        <Button variant="secondary" size="sm" className="mt-2 w-full" onClick={logout}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M8 4H4v12h4M12 6l4 4-4 4M16 10H8" />
          </svg>
          Sign out
        </Button>
      </div>
    </aside>
  );
}
