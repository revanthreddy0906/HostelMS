import { Link } from 'react-router-dom';

export function ForbiddenPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2 text-center">
      <div className="text-5xl font-bold text-neutral-300">403</div>
      <p className="text-neutral-600">You don't have permission to view this page.</p>
      <Link to="/dashboard" className="mt-2 text-sm font-medium text-primary-600 hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
