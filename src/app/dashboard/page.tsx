'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users, UserPlus, Package, CalendarDays,
  AlertCircle, TrendingUp, Banknote, Activity,
  ArrowRight, Clock
} from 'lucide-react';
import Link from 'next/link';
import type { DashboardStats, Appointment, TherapyPackage, Patient } from '@/lib/types';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const statusLabels: Record<string, string> = {
  scheduled: 'Đã đặt lịch',
  completed: 'Đã đến',
  no_show: 'Không đến',
  cancelled: 'Đã hủy',
};

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  no_show: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export default function DashboardPage() {
  const supabase = createClient();
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0, newPatientsThisMonth: 0, activePackages: 0,
    todayAppointments: 0, patientsWithDebt: 0, monthlyRevenue: 0,
    totalDebt: 0, monthlyCompletedSessions: 0,
  });
  const [todayAppts, setTodayAppts] = useState<(Appointment & { patient?: Patient })[]>([]);
  const [debtPatients, setDebtPatients] = useState<{ full_name: string; patient_code: string; total_debt: number }[]>([]);
  const [nearCompletePackages, setNearCompletePackages] = useState<(TherapyPackage & { patient?: Patient; service?: { name: string } })[]>([]);
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      const { count: totalPatients } = await supabase.from('patients').select('*', { count: 'exact', head: true });
      const { count: newPatientsThisMonth } = await supabase.from('patients').select('*', { count: 'exact', head: true }).gte('created_at', monthStart);
      const { count: activePackages } = await supabase.from('therapy_packages').select('*', { count: 'exact', head: true }).eq('status', 'active');

      const { data: todayData, count: todayAppointments } = await supabase.from('appointments')
        .select('*, patient:patients(*)', { count: 'exact' })
        .eq('appointment_date', today)
        .order('appointment_time', { ascending: true });
      setTodayAppts((todayData || []) as (Appointment & { patient?: Patient })[]);

      const { data: debtPackages } = await supabase.from('therapy_packages')
        .select('debt_amount, patient:patients(full_name, patient_code)')
        .gt('debt_amount', 0);
      const debtMap = new Map<string, { full_name: string; patient_code: string; total_debt: number }>();
      (debtPackages || []).forEach((pkg: Record<string, unknown>) => {
        const p = pkg.patient as Record<string, string> | null;
        if (p) {
          const key = p.patient_code;
          const existing = debtMap.get(key);
          if (existing) { existing.total_debt += Number(pkg.debt_amount); }
          else { debtMap.set(key, { full_name: p.full_name, patient_code: p.patient_code, total_debt: Number(pkg.debt_amount) }); }
        }
      });
      const debtList = Array.from(debtMap.values()).sort((a, b) => b.total_debt - a.total_debt).slice(0, 5);
      setDebtPatients(debtList);
      const patientsWithDebt = debtMap.size;
      const totalDebt = debtList.reduce((acc, d) => acc + d.total_debt, 0);

      const { data: monthlyPayments } = await supabase.from('payments').select('amount').gte('payment_date', monthStart);
      const monthlyRevenue = (monthlyPayments || []).reduce((acc: number, p: { amount: number }) => acc + Number(p.amount), 0);

      const { count: monthlyCompletedSessions } = await supabase.from('appointments')
        .select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('appointment_date', monthStart);

      const { data: nearPkgs } = await supabase.from('therapy_packages')
        .select('*, patient:patients(full_name, patient_code), service:services(name)')
        .eq('status', 'active').lte('remaining_sessions', 2).gt('remaining_sessions', 0).limit(5);
      setNearCompletePackages((nearPkgs || []) as (TherapyPackage & { patient?: Patient; service?: { name: string } })[]);

      const { data: recent } = await supabase.from('patients').select('*').order('created_at', { ascending: false }).limit(5);
      setRecentPatients((recent || []) as Patient[]);

      setStats({
        totalPatients: totalPatients || 0, newPatientsThisMonth: newPatientsThisMonth || 0,
        activePackages: activePackages || 0, todayAppointments: todayAppointments || 0,
        patientsWithDebt, monthlyRevenue, totalDebt,
        monthlyCompletedSessions: monthlyCompletedSessions || 0,
      });
      setLoading(false);
    };
    loadDashboard();
  }, [supabase]);

  const statCards = [
    { label: 'Tổng bệnh nhân', value: stats.totalPatients, icon: Users, color: 'from-blue-500 to-blue-600', href: '/patients' },
    { label: 'BN mới tháng này', value: stats.newPatientsThisMonth, icon: UserPlus, color: 'from-emerald-500 to-emerald-600', href: '/patients' },
    { label: 'Gói đang điều trị', value: stats.activePackages, icon: Package, color: 'from-purple-500 to-purple-600', href: '/therapy-packages' },
    { label: 'Lịch hẹn hôm nay', value: stats.todayAppointments, icon: CalendarDays, color: 'from-orange-500 to-orange-600', href: '/appointments' },
    { label: 'BN còn nợ', value: stats.patientsWithDebt, icon: AlertCircle, color: 'from-red-500 to-red-600', href: '/payments' },
    { label: 'Doanh thu tháng', value: formatCurrency(stats.monthlyRevenue), icon: TrendingUp, color: 'from-teal-500 to-teal-600', href: '/reports' },
    { label: 'Tổng công nợ', value: formatCurrency(stats.totalDebt), icon: Banknote, color: 'from-amber-500 to-amber-600', href: '/payments' },
    { label: 'Buổi TL tháng này', value: stats.monthlyCompletedSessions, icon: Activity, color: 'from-cyan-500 to-cyan-600', href: '/appointments' },
  ];

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tổng quan</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {format(new Date(), "EEEE, dd/MM/yyyy", { locale: vi })}
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Link key={stat.label} href={stat.href}>
              <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-0 shadow-md hover:-translate-y-0.5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                      <stat.icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Tables */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Today appointments */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-500" />
                  Lịch hẹn hôm nay
                </CardTitle>
                <Link href="/appointments" className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                  Xem tất cả <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {todayAppts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Không có lịch hẹn hôm nay</p>
              ) : (
                <div className="space-y-3">
                  {todayAppts.slice(0, 5).map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{a.patient?.full_name || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{a.appointment_time?.slice(0, 5) || '--:--'}</p>
                      </div>
                      <Badge className={statusColors[a.status]} variant="secondary">
                        {statusLabels[a.status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Patients with most debt */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  BN còn nợ nhiều nhất
                </CardTitle>
                <Link href="/payments" className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                  Xem tất cả <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {debtPatients.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Không có công nợ</p>
              ) : (
                <div className="space-y-3">
                  {debtPatients.map((d) => (
                    <div key={d.patient_code} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{d.full_name}</p>
                        <p className="text-xs text-muted-foreground">{d.patient_code}</p>
                      </div>
                      <span className="text-sm font-semibold text-red-600">{formatCurrency(d.total_debt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Near complete packages */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-500" />
                  Gói sắp hoàn thành
                </CardTitle>
                <Link href="/therapy-packages" className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                  Xem tất cả <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {nearCompletePackages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Không có gói nào sắp hoàn thành</p>
              ) : (
                <div className="space-y-3">
                  {nearCompletePackages.map((pkg) => (
                    <div key={pkg.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{(pkg.patient as unknown as Patient)?.full_name || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{(pkg.service as unknown as { name: string })?.name || pkg.package_name}</p>
                      </div>
                      <span className="text-xs font-medium text-orange-600">
                        Còn {pkg.remaining_sessions} buổi
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent patients */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-500" />
                  BN mới gần đây
                </CardTitle>
                <Link href="/patients" className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                  Xem tất cả <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentPatients.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Chưa có bệnh nhân</p>
              ) : (
                <div className="space-y-3">
                  {recentPatients.map((p) => (
                    <Link key={p.id} href={`/patients/${p.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                        <div>
                          <p className="text-sm font-medium">{p.full_name}</p>
                          <p className="text-xs text-muted-foreground">{p.phone || 'Chưa có SĐT'}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{p.patient_code}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
