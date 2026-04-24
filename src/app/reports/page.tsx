'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

const COLORS = ['#0d9488', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#6366f1', '#ec4899'];

export default function ReportsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  // Chart data states
  const [dailyRevenue, setDailyRevenue] = useState<{ day: string; revenue: number }[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number }[]>([]);
  const [newPatientsByMonth, setNewPatientsByMonth] = useState<{ month: string; count: number }[]>([]);
  const [packagesByService, setPackagesByService] = useState<{ name: string; count: number }[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<{ name: string; value: number }[]>([]);
  const [topServices, setTopServices] = useState<{ name: string; count: number }[]>([]);
  const [debtByPatient, setDebtByPatient] = useState<{ name: string; debt: number }[]>([]);

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      const [year, month] = selectedMonth.split('-').map(Number);
      const start = startOfMonth(new Date(year, month - 1));
      const end = endOfMonth(new Date(year, month - 1));
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      // 1. Daily revenue for selected month
      const { data: monthPayments } = await supabase.from('payments')
        .select('amount, payment_date')
        .gte('payment_date', startStr)
        .lte('payment_date', endStr);

      const days = eachDayOfInterval({ start, end });
      const dailyMap = new Map<string, number>();
      days.forEach(d => dailyMap.set(format(d, 'dd'), 0));
      (monthPayments || []).forEach((p: { amount: number; payment_date: string }) => {
        const day = format(new Date(p.payment_date), 'dd');
        dailyMap.set(day, (dailyMap.get(day) || 0) + Number(p.amount));
      });
      setDailyRevenue(Array.from(dailyMap.entries()).map(([day, revenue]) => ({ day, revenue })));

      // 2. Monthly revenue (last 6 months)
      const monthlyData: { month: string; revenue: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const m = subMonths(new Date(), i);
        const mStart = format(startOfMonth(m), 'yyyy-MM-dd');
        const mEnd = format(endOfMonth(m), 'yyyy-MM-dd');
        const { data: mPay } = await supabase.from('payments').select('amount').gte('payment_date', mStart).lte('payment_date', mEnd);
        const total = (mPay || []).reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0);
        monthlyData.push({ month: format(m, 'MM/yyyy'), revenue: total });
      }
      setMonthlyRevenue(monthlyData);

      // 3. New patients by month (last 6 months)
      const patientData: { month: string; count: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const m = subMonths(new Date(), i);
        const mStart = startOfMonth(m).toISOString();
        const mEnd = endOfMonth(m).toISOString();
        const { count } = await supabase.from('patients').select('*', { count: 'exact', head: true }).gte('created_at', mStart).lte('created_at', mEnd);
        patientData.push({ month: format(m, 'MM/yyyy'), count: count || 0 });
      }
      setNewPatientsByMonth(patientData);

      // 4. Packages by service
      const { data: pkgs } = await supabase.from('therapy_packages')
        .select('service:services(name)').is('deleted_at', null);
      const svcMap = new Map<string, number>();
      (pkgs || []).forEach((p: Record<string, unknown>) => {
        const name = (p.service as Record<string, string>)?.name || 'Khác';
        svcMap.set(name, (svcMap.get(name) || 0) + 1);
      });
      setPackagesByService(Array.from(svcMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));

      // 5. Payment status
      const { data: allPkgs } = await supabase.from('therapy_packages')
        .select('total_amount, paid_amount').is('deleted_at', null);
      let unpaid = 0, partial = 0, paid = 0;
      (allPkgs || []).forEach((p: { total_amount: number; paid_amount: number }) => {
        if (Number(p.paid_amount) === 0) unpaid++;
        else if (Number(p.paid_amount) < Number(p.total_amount)) partial++;
        else paid++;
      });
      setPaymentStatus([
        { name: 'Chưa thanh toán', value: unpaid },
        { name: 'Thanh toán một phần', value: partial },
        { name: 'Đã thanh toán', value: paid },
      ]);

      // 6. Top services (reuse svcMap)
      setTopServices(Array.from(svcMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8));

      // 7. Debt by patient
      const { data: debtPkgs } = await supabase.from('therapy_packages')
        .select('debt_amount, patient:patients(full_name)')
        .gt('debt_amount', 0).is('deleted_at', null);
      const debtMap = new Map<string, number>();
      (debtPkgs || []).forEach((p: Record<string, unknown>) => {
        const name = (p.patient as Record<string, string>)?.full_name || 'N/A';
        debtMap.set(name, (debtMap.get(name) || 0) + Number(p.debt_amount));
      });
      setDebtByPatient(Array.from(debtMap.entries()).map(([name, debt]) => ({ name, debt })).sort((a, b) => b.debt - a.debt).slice(0, 10));

      setLoading(false);
    };
    loadReports();
  }, [supabase, selectedMonth]);

  // Month options
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MM/yyyy', { locale: vi }) };
  });

  if (loading) {
    return <AppShell><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div></AppShell>;
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h1 className="text-2xl font-bold">Báo cáo</h1><p className="text-sm text-muted-foreground">Thống kê doanh thu, bệnh nhân và dịch vụ</p></div>
          <Select value={selectedMonth} onValueChange={(v) => setSelectedMonth(v || selectedMonth)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Daily revenue */}
          <Card className="border-0 shadow-md lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Doanh thu theo ngày trong tháng</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                    <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Doanh thu']} />
                    <Bar dataKey="revenue" fill="url(#tealGrad)" radius={[4, 4, 0, 0]} />
                    <defs>
                      <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0d9488" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Monthly revenue */}
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-base">Doanh thu theo tháng</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                    <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Doanh thu']} />
                    <Line type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={2.5} dot={{ fill: '#0d9488', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* New patients by month */}
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-base">BN mới theo tháng</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={newPatientsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Bệnh nhân mới" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Packages by service */}
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-base">Gói trị liệu theo dịch vụ</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={packagesByService} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip />
                    <Bar dataKey="count" name="Số gói" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Payment status pie */}
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-base">Tỷ lệ trạng thái thanh toán</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentStatus} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={false}>
                      {paymentStatus.map((_, i) => <Cell key={i} fill={['#ef4444', '#f59e0b', '#10b981'][i]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top services */}
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-base">Top dịch vụ được sử dụng</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topServices}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Lượt sử dụng" radius={[4, 4, 0, 0]}>
                      {topServices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Debt by patient */}
          <Card className="border-0 shadow-md lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Công nợ theo bệnh nhân</CardTitle></CardHeader>
            <CardContent>
              {debtByPatient.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Không có công nợ</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={debtByPatient}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                      <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Công nợ']} />
                      <Bar dataKey="debt" name="Công nợ" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
