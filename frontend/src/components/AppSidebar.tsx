import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  BedDouble,
  Building2,
  CalendarCheck,
  ChevronsUpDown,
  DoorOpen,
  IdCard,
  LayoutDashboard,
  LogOut,
  MessageSquareWarning,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/types';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavItem {
  to: string;
  label: string;
  roles: Role[];
  icon: LucideIcon;
  /** Role-specific label, e.g. a student's own profile instead of the student list. */
  labelFor?: Partial<Record<Role, string>>;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const ALL: Role[] = ['Admin', 'Warden', 'Staff', 'Student'];

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', roles: ALL, icon: LayoutDashboard }],
  },
  {
    label: 'Residents',
    items: [
      { to: '/students', label: 'Students', roles: ['Admin', 'Student'], icon: Users, labelFor: { Student: 'My profile' } },
      { to: '/allocations', label: 'Allocations', roles: ['Admin', 'Warden'], icon: BedDouble },
      { to: '/hostels', label: 'Hostels & Rooms', roles: ['Admin', 'Warden'], icon: Building2 },
    ],
  },
  {
    label: 'Daily operations',
    items: [
      { to: '/attendance', label: 'Attendance', roles: ['Admin', 'Warden', 'Staff'], icon: CalendarCheck },
      { to: '/leaves', label: 'Leaves & Gate Pass', roles: ALL, icon: DoorOpen },
      { to: '/visitors', label: 'Visitors', roles: ['Admin', 'Warden', 'Staff'], icon: IdCard },
      { to: '/complaints', label: 'Complaints', roles: ALL, icon: MessageSquareWarning },
    ],
  },
  {
    label: 'Finance & reports',
    items: [
      { to: '/fees', label: 'Fees', roles: ['Admin', 'Student'], icon: Wallet },
      { to: '/reports', label: 'Reports', roles: ['Admin', 'Warden'], icon: BarChart3 },
    ],
  },
  {
    label: 'Administration',
    items: [{ to: '/staff', label: 'Staff', roles: ['Admin'], icon: UserCog }],
  },
];

const labelOf = (item: NavItem, role?: Role) => (role && item.labelFor?.[role]) || item.label;

export function pageTitleFor(pathname: string, role?: Role): string {
  for (const section of NAV_SECTIONS) {
    const match = section.items.find((item) => pathname.startsWith(item.to));
    if (match) return labelOf(match, role);
  }
  return '';
}

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  if (!user) return null;

  const sections = NAV_SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => i.roles.includes(user.role)) })).filter(
    (s) => s.items.length > 0,
  );
  const initial = user.username.charAt(0).toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Hostel MS">
              <NavLink to="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                  H
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">Hostel MS</span>
                  <span className="truncate text-xs text-muted-foreground">{user.role} workspace</span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.to)} tooltip={labelOf(item, user.role)}>
                      <NavLink to={item.to}>
                        <item.icon />
                        <span>{labelOf(item, user.role)}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">{initial}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.username}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.role}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-medium">{user.username}</div>
                  <div className="text-xs text-muted-foreground">Signed in as {user.role}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={logout}>
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
