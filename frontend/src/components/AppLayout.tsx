import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { LoadingState } from '@/components/Feedback';
import { AppSidebar, pageTitleFor } from '@/components/AppSidebar';
import { useAuth } from '@/context/AuthContext';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider } from '@/components/ui/tooltip';

export function AppLayout() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const title = pageTitleFor(pathname, user?.role);

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0 bg-neutral-50">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
            <span className="text-sm font-medium text-foreground">{title}</span>
          </header>
          <main className="flex-1 px-6 py-8 lg:px-8">
            <div className="mx-auto max-w-6xl">
              <Suspense fallback={<LoadingState />}>
                <Outlet />
              </Suspense>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
