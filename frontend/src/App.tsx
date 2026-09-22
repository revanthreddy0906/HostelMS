import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { HostelsPage } from './pages/HostelsPage';
import { AllocationsPage } from './pages/AllocationsPage';
import { FeesPage } from './pages/FeesPage';
import { ComplaintsPage } from './pages/ComplaintsPage';
import { VisitorsPage } from './pages/VisitorsPage';
import { AttendancePage } from './pages/AttendancePage';
import { LeavesPage } from './pages/LeavesPage';
import { ReportsPage } from './pages/ReportsPage';
import { StaffPage } from './pages/StaffPage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
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
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
