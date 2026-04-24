import AppSidebar from './AppSidebar';
import { Toaster } from '@/components/ui/sonner';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <div className="pt-16 lg:pt-0">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
