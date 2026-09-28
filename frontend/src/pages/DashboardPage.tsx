import { lazy, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LoadingState } from '@/components/Feedback';

const AdminDashboard = lazy(() => import('./dashboard/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const StaffDashboard = lazy(() => import('./dashboard/StaffDashboard').then((m) => ({ default: m.StaffDashboard })));
const StudentDashboard = lazy(() => import('./dashboard/StudentDashboard').then((m) => ({ default: m.StudentDashboard })));
const WardenDashboard = lazy(() => import('./dashboard/WardenDashboard').then((m) => ({ default: m.WardenDashboard })));

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  const Dashboard =
    user.role === 'Admin' ? AdminDashboard : user.role === 'Student' ? StudentDashboard : user.role === 'Warden' ? WardenDashboard : StaffDashboard;

  return (
    <Suspense fallback={<LoadingState />}>
      <Dashboard />
    </Suspense>
  );
}
