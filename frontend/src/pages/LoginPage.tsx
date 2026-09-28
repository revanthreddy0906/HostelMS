import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useReducedMotion } from 'motion/react';
import { AlertCircle, BedDouble, CalendarCheck, ShieldCheck, Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { roleHome } from '@/routes/roleHome';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SoftAurora from '@/components/SoftAurora';
import ShinyText from '@/components/ShinyText';

const HIGHLIGHTS = [
  { icon: BedDouble, text: 'Room allocation and transfers' },
  { icon: Wallet, text: 'Fee dues, payments and receipts' },
  { icon: CalendarCheck, text: 'Attendance, leave and gate passes' },
  { icon: ShieldCheck, text: 'Visitor and security logs' },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
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
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#1e1b4b] text-white lg:flex lg:flex-col">
        {!reduceMotion && (
          <div className="absolute inset-0 opacity-80" aria-hidden="true">
            <SoftAurora color1="#c7d2fe" color2="#6366f1" speed={0.35} brightness={0.9} enableMouseInteraction={false} />
          </div>
        )}
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-white/15 text-sm font-semibold ring-1 ring-white/25 backdrop-blur">
              H
            </div>
            <span className="text-sm font-medium text-white/90">Hostel MS</span>
          </div>

          <div className="max-w-md">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight">
              <ShinyText
                text="Hostel Management System"
                color="#e0e7ff"
                shineColor="#ffffff"
                speed={3}
                delay={4}
                disabled={!!reduceMotion}
              />
            </h1>
            <p className="mt-4 text-base text-indigo-100/90">
              One place for residents, wardens, staff and administrators to run daily hostel operations.
            </p>
            <ul className="mt-8 space-y-3">
              {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-indigo-50">
                  <span className="flex size-8 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/15">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-indigo-200/80">Access is limited to your role: Student, Warden, Staff or Admin.</p>
        </div>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-8">
            <div className="mb-6 flex size-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground lg:hidden">
              H
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">Use your roll number or staff username.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="h-10"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="h-10 w-full" disabled={submitting || !username || !password}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
