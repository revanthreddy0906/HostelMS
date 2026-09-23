import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/Button';
import { TextField } from '../components/Form';
import { roleHome } from '../routes/roleHome';
import { ApiError } from '../api/client';

export function LoginPage() {
  const { user, login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to={roleHome(user.role)} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const u = await login(username, password);
      showToast(`Welcome back, ${u.username}.`, 'success');
      navigate(roleHome(u.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid username or password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-lg font-semibold text-white shadow-sm">
            H
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Hostel Management System</h1>
          <p className="mt-1.5 text-sm text-neutral-600">Sign in to your account to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error && (
            <div role="alert" className="mb-4 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
              {error}
            </div>
          )}
          <Button type="submit" className="mt-2 w-full" loading={submitting}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
