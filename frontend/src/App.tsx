import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingState } from './components/Feedback';

const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const StudentsPage = lazy(() => import('./pages/StudentsPage').then((m) => ({ default: m.StudentsPage })));
const HostelsPage = lazy(() => import('./pages/HostelsPage').then((m) => ({ default: m.HostelsPage })));
const AllocationsPage = lazy(() => import('./pages/AllocationsPage').then((m) => ({ default: m.AllocationsPage })));
const FeesPage = lazy(() => import('./pages/FeesPage').then((m) => ({ default: m.FeesPage })));
const ComplaintsPage = lazy(() => import('./pages/ComplaintsPage').then((m) => ({ default: m.ComplaintsPage })));
const VisitorsPage = lazy(() => import('./pages/VisitorsPage').then((m) => ({ default: m.VisitorsPage })));
const AttendancePage = lazy(() => import('./pages/AttendancePage').then((m) => ({ default: m.AttendancePage })));
const LeavesPage = lazy(() => import('./pages/LeavesPage').then((m) => ({ default: m.LeavesPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const StaffPage = lazy(() => import('./pages/StaffPage').then((m) => ({ default: m.StaffPage })));
const ForbiddenPage = lazy(() => import('./pages/ForbiddenPage').then((m) => ({ default: m.ForbiddenPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingState />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/403" element={<ForbiddenPage />} />

            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route
                path="/students"
                element={
                  <ProtectedRoute roles={['Admin', 'Student']}>
                    <StudentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hostels"
                element={
                  <ProtectedRoute roles={['Admin', 'Warden']}>
                    <HostelsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/allocations"
                element={
                  <ProtectedRoute roles={['Admin', 'Warden']}>
                    <AllocationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/fees"
                element={
                  <ProtectedRoute roles={['Admin', 'Student']}>
                    <FeesPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/complaints" element={<ComplaintsPage />} />
              <Route
                path="/visitors"
                element={
                  <ProtectedRoute roles={['Admin', 'Warden', 'Staff']}>
                    <VisitorsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendance"
                element={
                  <ProtectedRoute roles={['Admin', 'Warden', 'Staff']}>
                    <AttendancePage />
                  </ProtectedRoute>
                }
              />
              <Route path="/leaves" element={<LeavesPage />} />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute roles={['Admin', 'Warden']}>
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/staff"
                element={
                  <ProtectedRoute roles={['Admin']}>
                    <StaffPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
    </MotionConfig>
  );
}
