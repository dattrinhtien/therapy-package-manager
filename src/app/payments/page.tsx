'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Loader2, CreditCard, Banknote } from 'lucide-react';
import type { Payment, Patient, TherapyPackage, Service } from '@/lib/types';
import { toast } from 'sonner';
import { format } from 'date-fns';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

const methodLabels: Record<string, string> = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', other: 'Khác' };

export default function PaymentsPage() {
  const supabase = createClient();
  const [payments, setPayments] = useState<(Payment & { patient?: Patient; therapy_package?: TherapyPackage })[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientPackages, setPatientPackages] = useState<(TherapyPackage & { service?: Service })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterDebt, setFilterDebt] = useState(false);
  const [form, setForm] = useState({
    patient_id: '', therapy_package_id: '', amount: '',
    payment_method: 'cash', payment_date: new Date().toISOString().split('T')[0], note: '',
  });

  const loadPayments = async () => {
    const { data: pays } = await supabase.from('payments')
      .select('*, patient:patients(id,full_name,patient_code), therapy_package:therapy_packages(id,package_name,total_amount,paid_amount,debt_amount)')
      .order('payment_date', { ascending: false })
      .limit(100);
    setPayments((pays || []) as (Payment & { patient?: Patient; therapy_package?: TherapyPackage })[]);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    const loadPatients = async () => {
      const { data: pts } = await supabase.from('patients').select('id,full_name,patient_code').is('deleted_at', null).order('full_name');
      setPatients((pts || []) as Patient[]);
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPayments();
    loadPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const loadPatientPackages = async (patientId: string) => {
    const { data } = await supabase.from('therapy_packages')
      .select('*, service:services(id,name)')
      .eq('patient_id', patientId)
      .gt('debt_amount', 0)
      .is('deleted_at', null);
    setPatientPackages((data || []) as (TherapyPackage & { service?: Service })[]);
  };

  const updateField = (field: string, value: string | null) => {
    const val = value || '';
    setForm(prev => {
      const updated = { ...prev, [field]: val };
      if (field === 'patient_id') { loadPatientPackages(val); updated.therapy_package_id = ''; }
      return updated;
    });
  };

  const handleCreate = async () => {
    if (!form.patient_id) { toast.error('Chọn bệnh nhân'); return; }
    if (!form.therapy_package_id) { toast.error('Chọn gói trị liệu'); return; }
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { toast.error('Số tiền không hợp lệ'); return; }

    const pkg = patientPackages.find(p => p.id === form.therapy_package_id);
    if (pkg && amount > Number(pkg.debt_amount)) {
      if (!confirm(`Số tiền (${formatCurrency(amount)}) lớn hơn số nợ (${formatCurrency(Number(pkg.debt_amount))}). Tiếp tục?`)) return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Phiên hết hạn'); setSaving(false); return; }

    const { error } = await supabase.from('payments').insert({
      owner_id: user.id, patient_id: form.patient_id,
      therapy_package_id: form.therapy_package_id, amount,
      payment_method: form.payment_method, payment_date: form.payment_date,
      note: form.note || null,
    });
    if (error) { toast.error('Lỗi: ' + error.message); setSaving(false); return; }

    // Update package paid_amount and debt_amount
    if (pkg) {
      const newPaid = Number(pkg.paid_amount) + amount;
      const newDebt = Math.max(0, Number(pkg.total_amount) - newPaid);
      await supabase.from('therapy_packages').update({
        paid_amount: newPaid, debt_amount: newDebt, updated_at: new Date().toISOString(),
      }).eq('id', form.therapy_package_id);
    }

    toast.success('Ghi nhận thanh toán thành công');
    setDialogOpen(false);
    setForm({ patient_id: '', therapy_package_id: '', amount: '', payment_method: 'cash', payment_date: new Date().toISOString().split('T')[0], note: '' });
    loadPayments();
    setSaving(false);
  };

  // Debt patients summary
  const [debtSummary, setDebtSummary] = useState<{ full_name: string; patient_code: string; total_debt: number; patient_id: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('therapy_packages')
        .select('debt_amount, patient_id, patient:patients(full_name, patient_code)')
        .gt('debt_amount', 0).is('deleted_at', null);
      const map = new Map<string, { full_name: string; patient_code: string; total_debt: number; patient_id: string }>();
      (data || []).forEach((d: Record<string, unknown>) => {
        const p = d.patient as Record<string, string> | null;
        const pid = d.patient_id as string;
        if (p) {
          const existing = map.get(pid);
          if (existing) existing.total_debt += Number(d.debt_amount);
          else map.set(pid, { full_name: p.full_name, patient_code: p.patient_code, total_debt: Number(d.debt_amount), patient_id: pid });
        }
      });
      setDebtSummary(Array.from(map.values()).sort((a, b) => b.total_debt - a.total_debt));
    })();
  }, [supabase, payments]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h1 className="text-2xl font-bold">Thanh toán</h1><p className="text-sm text-muted-foreground">Quản lý thanh toán và công nợ</p></div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button className="bg-gradient-to-r from-teal-500 to-cyan-600 shadow-lg shadow-teal-500/25"><Plus className="w-4 h-4 mr-2" />Ghi nhận thanh toán</Button>} />
            <DialogContent>
              <DialogHeader><DialogTitle>Ghi nhận thanh toán mới</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Bệnh nhân *</Label>
                  <Select value={form.patient_id} onValueChange={v => updateField('patient_id', v)}>
                    <SelectTrigger><SelectValue placeholder="Chọn bệnh nhân" /></SelectTrigger>
                    <SelectContent>{patients.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.patient_code})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {patientPackages.length > 0 && (
                  <div className="space-y-2">
                    <Label>Gói trị liệu (còn nợ) *</Label>
                    <Select value={form.therapy_package_id} onValueChange={v => updateField('therapy_package_id', v)}>
                      <SelectTrigger><SelectValue placeholder="Chọn gói" /></SelectTrigger>
                      <SelectContent>{patientPackages.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {(p.service as unknown as Service)?.name || p.package_name} — Nợ: {formatCurrency(Number(p.debt_amount))}
                        </SelectItem>
                      ))}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Số tiền (VNĐ) *</Label><Input type="number" placeholder="500000" value={form.amount} onChange={e => updateField('amount', e.target.value)} /></div>
                  <div className="space-y-2">
                    <Label>Phương thức</Label>
                    <Select value={form.payment_method} onValueChange={v => updateField('payment_method', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Tiền mặt</SelectItem>
                        <SelectItem value="transfer">Chuyển khoản</SelectItem>
                        <SelectItem value="other">Khác</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label>Ngày thanh toán</Label><Input type="date" value={form.payment_date} onChange={e => updateField('payment_date', e.target.value)} /></div>
                <div className="space-y-2"><Label>Ghi chú</Label><Textarea placeholder="Ghi chú..." value={form.note} onChange={e => updateField('note', e.target.value)} rows={2} /></div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
                  <Button onClick={handleCreate} disabled={saving} className="bg-gradient-to-r from-teal-500 to-cyan-600">
                    {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Đang lưu...</> : 'Ghi nhận'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-2">
          <Button variant={!filterDebt ? 'default' : 'outline'} size="sm" onClick={() => setFilterDebt(false)}
            className={!filterDebt ? 'bg-gradient-to-r from-teal-500 to-cyan-600' : ''}>Lịch sử TT</Button>
          <Button variant={filterDebt ? 'default' : 'outline'} size="sm" onClick={() => setFilterDebt(true)}
            className={filterDebt ? 'bg-gradient-to-r from-teal-500 to-cyan-600' : ''}>
            <Banknote className="w-3.5 h-3.5 mr-1" />BN còn nợ ({debtSummary.length})
          </Button>
        </div>

        {filterDebt ? (
          debtSummary.length === 0 ? (
            <Card className="border-0 shadow-md"><CardContent className="py-12 text-center text-muted-foreground">Không có bệnh nhân nào còn nợ</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {debtSummary.map(d => (
                <Card key={d.patient_id} className="border-0 shadow-sm hover:shadow-md transition-all">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{d.full_name}</p>
                      <p className="text-xs text-muted-foreground">{d.patient_code}</p>
                    </div>
                    <span className="text-base font-bold text-red-600">{formatCurrency(d.total_debt)}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : loading ? (
          <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div>
        ) : payments.length === 0 ? (
          <Card className="border-0 shadow-md"><CardContent className="py-12 text-center text-muted-foreground">Chưa có thanh toán nào</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {payments.map(pay => (
              <Card key={pay.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center shrink-0">
                        <CreditCard className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{(pay.patient as unknown as Patient)?.full_name || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">
                          {(pay.therapy_package as unknown as TherapyPackage)?.package_name || 'Gói trị liệu'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-[10px]">{methodLabels[pay.payment_method]}</Badge>
                      <span className="text-base font-bold text-green-600">{formatCurrency(Number(pay.amount))}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(pay.payment_date), 'dd/MM/yyyy')}</span>
                    </div>
                  </div>
                  {pay.note && <p className="text-xs text-muted-foreground mt-2 pl-13">{pay.note}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
