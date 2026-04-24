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
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Loader2, Package } from 'lucide-react';
import type { TherapyPackage, Patient, Service } from '@/lib/types';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

const statusLabels: Record<string, string> = { active: 'Đang điều trị', completed: 'Hoàn thành', paused: 'Tạm dừng', cancelled: 'Hủy' };
const statusColors: Record<string, string> = { active: 'bg-green-100 text-green-700', completed: 'bg-slate-200 text-slate-700', paused: 'bg-yellow-100 text-yellow-700', cancelled: 'bg-red-100 text-red-700' };

export default function TherapyPackagesPage() {
  const supabase = createClient();
  const [packages, setPackages] = useState<(TherapyPackage & { patient?: Patient; service?: Service })[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [form, setForm] = useState({
    patient_id: '', service_id: '', package_type: '5',
    total_sessions: '5', start_date: new Date().toISOString().split('T')[0],
    total_amount: '', paid_amount: '0', treatment_note: '',
  });

  const loadData = async () => {
    let query = supabase.from('therapy_packages').select('*, patient:patients(id,full_name,patient_code), service:services(id,name)').is('deleted_at', null).order('created_at', { ascending: false });
    if (filterStatus !== 'all') query = query.eq('status', filterStatus);
    const { data } = await query;
    setPackages((data || []) as (TherapyPackage & { patient?: Patient; service?: Service })[]);

    const { data: pts } = await supabase.from('patients').select('id,full_name,patient_code').is('deleted_at', null).order('full_name');
    setPatients((pts || []) as Patient[]);

    const { data: svcs } = await supabase.from('services').select('id,name,default_price,default_sessions').is('deleted_at', null).eq('is_active', true).order('name');
    setServices((svcs || []) as Service[]);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, filterStatus]);

  const updateField = (field: string, value: string | null) => {
    const val = value || '';
    setForm(prev => {
      const updated = { ...prev, [field]: val };
      if (field === 'package_type' && val !== 'custom') {
        updated.total_sessions = val;
      }
      if (field === 'service_id') {
        const svc = services.find(s => s.id === val);
        if (svc) {
          const sessions = parseInt(updated.total_sessions) || 5;
          updated.total_amount = String(Number(svc.default_price) * sessions);
        }
      }
      if (field === 'total_sessions' || field === 'package_type') {
        const svc = services.find(s => s.id === updated.service_id);
        if (svc) {
          const sessions = parseInt(field === 'total_sessions' ? val : updated.total_sessions) || 5;
          updated.total_amount = String(Number(svc.default_price) * sessions);
        }
      }
      return updated;
    });
  };

  const handleCreate = async () => {
    if (!form.patient_id) { toast.error('Chọn bệnh nhân'); return; }
    if (!form.service_id) { toast.error('Chọn dịch vụ'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Phiên hết hạn'); setSaving(false); return; }

    const totalSessions = parseInt(form.total_sessions) || 5;
    const totalAmount = parseFloat(form.total_amount) || 0;
    const paidAmount = parseFloat(form.paid_amount) || 0;
    const svc = services.find(s => s.id === form.service_id);
    const pt = patients.find(p => p.id === form.patient_id);

    const { error } = await supabase.from('therapy_packages').insert({
      owner_id: user.id,
      patient_id: form.patient_id,
      service_id: form.service_id,
      package_name: `${svc?.name || 'Gói'} - ${pt?.full_name || ''} (${totalSessions} buổi)`,
      total_sessions: totalSessions,
      used_sessions: 0,
      remaining_sessions: totalSessions,
      start_date: form.start_date,
      expected_end_date: format(addDays(new Date(form.start_date), totalSessions * 2), 'yyyy-MM-dd'),
      status: 'active',
      total_amount: totalAmount,
      paid_amount: paidAmount,
      debt_amount: totalAmount - paidAmount,
      treatment_note: form.treatment_note || null,
    });

    if (error) toast.error('Lỗi: ' + error.message);
    else {
      // If paid_amount > 0, create a payment record
      if (paidAmount > 0) {
        const { data: newPkg } = await supabase.from('therapy_packages')
          .select('id').eq('owner_id', user.id).eq('patient_id', form.patient_id)
          .order('created_at', { ascending: false }).limit(1).single();
        if (newPkg) {
          await supabase.from('payments').insert({
            owner_id: user.id, patient_id: form.patient_id,
            therapy_package_id: newPkg.id, amount: paidAmount,
            payment_method: 'cash', payment_date: form.start_date,
            note: 'Thanh toán khi tạo gói',
          });
        }
      }
      toast.success('Tạo gói trị liệu thành công');
      setDialogOpen(false);
      setForm({ patient_id: '', service_id: '', package_type: '5', total_sessions: '5', start_date: new Date().toISOString().split('T')[0], total_amount: '', paid_amount: '0', treatment_note: '' });
      loadData();
    }
    setSaving(false);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h1 className="text-2xl font-bold">Gói trị liệu</h1><p className="text-sm text-muted-foreground">Quản lý các gói điều trị cho bệnh nhân</p></div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button className="bg-gradient-to-r from-teal-500 to-cyan-600 shadow-lg shadow-teal-500/25"><Plus className="w-4 h-4 mr-2" />Tạo gói mới</Button>} />
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Tạo gói trị liệu mới</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Bệnh nhân *</Label>
                  <Select value={form.patient_id} onValueChange={v => updateField('patient_id', v)}>
                    <SelectTrigger><SelectValue placeholder="Chọn bệnh nhân" /></SelectTrigger>
                    <SelectContent>{patients.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.patient_code})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Dịch vụ *</Label>
                  <Select value={form.service_id} onValueChange={v => updateField('service_id', v)}>
                    <SelectTrigger><SelectValue placeholder="Chọn dịch vụ" /></SelectTrigger>
                    <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name} — {formatCurrency(Number(s.default_price))}/buổi</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Loại gói</Label>
                    <Select value={form.package_type} onValueChange={v => updateField('package_type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 buổi</SelectItem>
                        <SelectItem value="10">10 buổi</SelectItem>
                        <SelectItem value="custom">Tùy chỉnh</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tổng số buổi</Label>
                    <Input type="number" min="1" value={form.total_sessions} onChange={e => updateField('total_sessions', e.target.value)} disabled={form.package_type !== 'custom'} />
                  </div>
                </div>
                <div className="space-y-2"><Label>Ngày bắt đầu</Label><Input type="date" value={form.start_date} onChange={e => updateField('start_date', e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Tổng tiền (VNĐ)</Label><Input type="number" value={form.total_amount} onChange={e => updateField('total_amount', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Thanh toán trước</Label><Input type="number" value={form.paid_amount} onChange={e => updateField('paid_amount', e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Ghi chú điều trị</Label><Textarea placeholder="Ghi chú..." value={form.treatment_note} onChange={e => updateField('treatment_note', e.target.value)} rows={2} /></div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
                  <Button onClick={handleCreate} disabled={saving} className="bg-gradient-to-r from-teal-500 to-cyan-600">
                    {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Đang tạo...</> : 'Tạo gói'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[{ v: 'all', l: 'Tất cả' }, { v: 'active', l: 'Đang điều trị' }, { v: 'completed', l: 'Hoàn thành' }, { v: 'paused', l: 'Tạm dừng' }, { v: 'cancelled', l: 'Hủy' }].map(f => (
            <Button key={f.v} variant={filterStatus === f.v ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus(f.v)}
              className={filterStatus === f.v ? 'bg-gradient-to-r from-teal-500 to-cyan-600' : ''}>{f.l}</Button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div>
        ) : packages.length === 0 ? (
          <Card className="border-0 shadow-md"><CardContent className="py-12 text-center text-muted-foreground">Chưa có gói trị liệu nào</CardContent></Card>
        ) : (
          <div className="grid gap-4">
            {packages.map(pkg => (
              <Card key={pkg.id} className="border-0 shadow-sm hover:shadow-md transition-all duration-200">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{(pkg.patient as unknown as Patient)?.full_name || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{(pkg.service as unknown as Service)?.name || pkg.package_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[pkg.status]} variant="secondary">{statusLabels[pkg.status]}</Badge>
                      {Number(pkg.debt_amount) > 0 && <Badge variant="destructive" className="text-[10px]">Còn nợ</Badge>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <Progress value={(pkg.used_sessions / pkg.total_sessions) * 100} className="flex-1 h-2.5" />
                    <span className="text-sm font-medium whitespace-nowrap">{pkg.used_sessions}/{pkg.total_sessions} buổi</span>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>Bắt đầu: {format(new Date(pkg.start_date), 'dd/MM/yyyy')}</span>
                    <span>Tổng: {formatCurrency(Number(pkg.total_amount))}</span>
                    <span>Đã TT: <span className="text-green-600">{formatCurrency(Number(pkg.paid_amount))}</span></span>
                    {Number(pkg.debt_amount) > 0 && <span>Nợ: <span className="text-red-600 font-medium">{formatCurrency(Number(pkg.debt_amount))}</span></span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
