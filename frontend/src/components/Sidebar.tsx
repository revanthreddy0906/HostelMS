import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';

interface NavItem {
  to: string;
  label: string;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', roles: ['Admin', 'Warden', 'Staff', 'Student'] },
  { to: '/students', label: 'Students', roles: ['Admin', 'Student'] },
  { to: '/hostels', label: 'Hostels & Rooms', roles: ['Admin', 'Warden'] },
  { to: '/allocations', label: 'Allocations', roles: ['Admin', 'Warden'] },
  { to: '/fees', label: 'Fees', roles: ['Admin', 'Student'] },
  { to: '/complaints', label: 'Complaints', roles: ['Admin', 'Warden', 'Staff', 'Student'] },
  { to: '/visitors', label: 'Visitors', roles: ['Admin', 'Warden', 'Staff'] },
  { to: '/attendance', label: 'Attendance', roles: ['Admin', 'Warden', 'Staff'] },
  { to: '/leaves', label: 'Leaves & Gate Pass', roles: ['Admin', 'Warden', 'Staff', 'Student'] },
  { to: '/reports', label: 'Reports', roles: ['Admin', 'Warden'] },
  { to: '/staff', label: 'Staff', roles: ['Admin'] },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
          H
        </div>
        <div className="text-sm font-bold text-neutral-800">Hostel MS</div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-primary-50 text-primary-700' : 'text-neutral-600 hover:bg-neutral-100'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-neutral-100 px-4 py-3.5">
        <div className="mb-2 truncate text-xs text-neutral-500">
          <span className="font-semibold text-neutral-700">{user.username}</span>
          <br />
          {user.role}
        </div>
        <button
          onClick={logout}
          className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
