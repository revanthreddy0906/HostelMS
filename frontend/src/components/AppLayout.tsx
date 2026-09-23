import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-neutral-50">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
