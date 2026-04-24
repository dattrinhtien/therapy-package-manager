'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Package,
  CalendarDays,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Heart,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const navItems = [
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/patients', label: 'Bệnh nhân', icon: Users },
  { href: '/services', label: 'Dịch vụ', icon: Stethoscope },
  { href: '/therapy-packages', label: 'Gói trị liệu', icon: Package },
  { href: '/appointments', label: 'Lịch hẹn', icon: CalendarDays },
  { href: '/payments', label: 'Thanh toán', icon: CreditCard },
  { href: '/reports', label: 'Báo cáo', icon: BarChart3 },
  { href: '/settings', label: 'Cài đặt', icon: Settings },
];

function NavContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-border/50">
        <Link href="/dashboard" className="flex items-center gap-3" onClick={onItemClick}>
          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/25">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
              Quản lý trị liệu
            </h1>
            <p className="text-[10px] text-muted-foreground tracking-wide uppercase">
              Therapy Manager
            </p>
          </div>
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
                ${isActive
                  ? 'bg-gradient-to-r from-teal-500/10 to-cyan-500/10 text-teal-700 shadow-sm border border-teal-500/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
            >
              <item.icon className={`w-4.5 h-4.5 transition-colors ${isActive ? 'text-teal-600' : 'group-hover:text-teal-500'}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-border/50">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-red-600 hover:bg-red-50 w-full transition-all duration-200"
        >
          <LogOut className="w-4.5 h-4.5" />
          Đăng xuất
        </button>
      </div>
    </div>
  );
}

export default function AppSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-border/50 bg-card/50 backdrop-blur-sm flex-col h-screen sticky top-0">
        <NavContent />
      </aside>

      {/* Mobile sidebar trigger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center">
            <Heart className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
            Quản lý trị liệu
          </span>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={
            <Button variant="ghost" size="icon" className="lg:hidden">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          } />
          <SheetContent side="left" className="p-0 w-72">
            <NavContent onItemClick={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
