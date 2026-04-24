'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Edit, Save, X, Loader2, Package, CreditCard, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import type { Patient, TherapyPackage, Payment } from '@/lib/types';
import { toast } from 'sonner';
import { format } from 'date-fns';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

const statusLabels: Record<string, string> = { active: 'Đang điều trị', completed: 'Hoàn thành', paused: 'Tạm dừng', cancelled: 'Hủy' };
const statusColors: Record<string, string> = { active: 'bg-green-100 text-green-700', completed: 'bg-slate-100 text-slate-600', paused: 'bg-yellow-100 text-yellow-700', cancelled: 'bg-red-100 text-red-700' };

export default function PatientDetailPage() {
  const { id } = useParams();
  const supabase = createClient();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [packages, setPackages] = useState<(TherapyPackage & { service?: { name: string } })[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Patient>>({});

  const loadData = async () => {
    const { data: p } = await supabase.from('patients').select('*').eq('id', id).single();
    if (p) {
      setPatient(p as Patient);
      setForm(p as Patient);
    }
    const { data: pkgs } = await supabase.from('therapy_packages').select('*, service:services(name)').eq('patient_id', id).is('deleted_at', null).order('created_at', { ascending: false });
    setPackages((pkgs || []) as (TherapyPackage & { service?: { name: string } })[]);

    const { data: pays } = await supabase.from('payments').select('*').eq('patient_id', id).order('payment_date', { ascending: false });
    setPayments((pays || []) as Payment[]);

    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, id]);

  const updateField = (field: string, value: string | null) => setForm(prev => ({ ...prev, [field]: value || '' }));

  const handleSave = async () => {
    if (!form.full_name?.trim()) { toast.error('Họ tên không được trống'); return; }
    setSaving(true);
    const { error } = await supabase.from('patients').update({
      full_name: form.full_name, gender: form.gender || null,
      date_of_birth: form.date_of_birth || null, phone: form.phone || null,
      address: form.address || null, occupation: form.occupation || null,
      medical_history: form.medical_history || null, main_symptoms: form.main_symptoms || null,
      note: form.note || null, updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { toast.error('Lỗi: ' + error.message); }
    else { toast.success('Cập nhật thành công'); setEditing(false); loadData(); }
    setSaving(false);
  };

  const totalPurchased = packages.reduce((s, p) => s + Number(p.total_amount), 0);
  const totalPaid = packages.reduce((s, p) => s + Number(p.paid_amount), 0);
  const totalDebt = packages.reduce((s, p) => s + Number(p.debt_amount), 0);

  if (loading) return <AppShell><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div></AppShell>;
  if (!patient) return <AppShell><div className="text-center py-12"><p>Không tìm thấy bệnh nhân</p><Link href="/patients"><Button className="mt-4">Quay lại</Button></Link></div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/patients"><Button variant="ghost" size="icon" className="rounded-xl"><ArrowLeft className="w-4 h-4" /></Button></Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{patient.full_name}</h1>
                <Badge variant="secondary">{patient.patient_code}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Hồ sơ bệnh nhân</p>
            </div>
          </div>
          {!editing ? (
            <Button variant="outline" onClick={() => setEditing(true)}><Edit className="w-4 h-4 mr-2" />Sửa</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setEditing(false); setForm(patient); }}><X className="w-4 h-4 mr-2" />Hủy</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-teal-500 to-cyan-600">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}{saving ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </div>
          )}
        </div>

        {/* Financial summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Tổng mua gói</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(totalPurchased)}</p>
          </CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Đã thanh toán</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</p>
          </CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Còn nợ</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totalDebt)}</p>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="info">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="info">Thông tin</TabsTrigger>
            <TabsTrigger value="packages">Gói trị liệu ({packages.length})</TabsTrigger>
            <TabsTrigger value="payments">Thanh toán ({payments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-base">Thông tin cá nhân</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Họ và tên</Label>
                    {editing ? <Input value={form.full_name || ''} onChange={e => updateField('full_name', e.target.value)} /> : <p className="text-sm p-2 bg-muted/50 rounded-lg">{patient.full_name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Giới tính</Label>
                    {editing ? (
                      <Select value={form.gender || ''} onValueChange={v => updateField('gender', v)}>
                        <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
                        <SelectContent><SelectItem value="male">Nam</SelectItem><SelectItem value="female">Nữ</SelectItem><SelectItem value="other">Khác</SelectItem></SelectContent>
                      </Select>
                    ) : <p className="text-sm p-2 bg-muted/50 rounded-lg">{({ male: 'Nam', female: 'Nữ', other: 'Khác' } as Record<string, string>)[patient.gender || ''] || '—'}</p>}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Ngày sinh</Label>{editing ? <Input type="date" value={form.date_of_birth || ''} onChange={e => updateField('date_of_birth', e.target.value)} /> : <p className="text-sm p-2 bg-muted/50 rounded-lg">{patient.date_of_birth ? format(new Date(patient.date_of_birth), 'dd/MM/yyyy') : '—'}</p>}</div>
                  <div className="space-y-2"><Label>Điện thoại</Label>{editing ? <Input value={form.phone || ''} onChange={e => updateField('phone', e.target.value)} /> : <p className="text-sm p-2 bg-muted/50 rounded-lg">{patient.phone || '—'}</p>}</div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Địa chỉ</Label>{editing ? <Input value={form.address || ''} onChange={e => updateField('address', e.target.value)} /> : <p className="text-sm p-2 bg-muted/50 rounded-lg">{patient.address || '—'}</p>}</div>
                  <div className="space-y-2"><Label>Nghề nghiệp</Label>{editing ? <Input value={form.occupation || ''} onChange={e => updateField('occupation', e.target.value)} /> : <p className="text-sm p-2 bg-muted/50 rounded-lg">{patient.occupation || '—'}</p>}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-base">Thông tin y tế</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Tiền sử bệnh</Label>{editing ? <Textarea value={form.medical_history || ''} onChange={e => updateField('medical_history', e.target.value)} rows={3} /> : <p className="text-sm p-2 bg-muted/50 rounded-lg whitespace-pre-wrap">{patient.medical_history || '—'}</p>}</div>
                <div className="space-y-2"><Label>Triệu chứng chính</Label>{editing ? <Textarea value={form.main_symptoms || ''} onChange={e => updateField('main_symptoms', e.target.value)} rows={3} /> : <p className="text-sm p-2 bg-muted/50 rounded-lg whitespace-pre-wrap">{patient.main_symptoms || '—'}</p>}</div>
                <div className="space-y-2"><Label>Ghi chú</Label>{editing ? <Textarea value={form.note || ''} onChange={e => updateField('note', e.target.value)} rows={2} /> : <p className="text-sm p-2 bg-muted/50 rounded-lg whitespace-pre-wrap">{patient.note || '—'}</p>}</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="packages" className="mt-4 space-y-3">
            {packages.length === 0 ? <Card className="border-0 shadow-sm"><CardContent className="py-8 text-center text-muted-foreground">Chưa có gói trị liệu</CardContent></Card> : packages.map(pkg => (
              <Card key={pkg.id} className="border-0 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-teal-500" />
                      <span className="font-semibold text-sm">{pkg.package_name}</span>
                      <Badge className={statusColors[pkg.status]} variant="secondary">{statusLabels[pkg.status]}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{(pkg.service as unknown as { name: string })?.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={(pkg.used_sessions / pkg.total_sessions) * 100} className="flex-1 h-2" />
                    <span className="text-xs font-medium whitespace-nowrap">{pkg.used_sessions}/{pkg.total_sessions} buổi</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Tổng: {formatCurrency(Number(pkg.total_amount))}</span>
                    <span>Đã TT: {formatCurrency(Number(pkg.paid_amount))}</span>
                    <span className={Number(pkg.debt_amount) > 0 ? 'text-red-600 font-medium' : ''}>Nợ: {formatCurrency(Number(pkg.debt_amount))}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="payments" className="mt-4 space-y-3">
            {payments.length === 0 ? <Card className="border-0 shadow-sm"><CardContent className="py-8 text-center text-muted-foreground">Chưa có thanh toán</CardContent></Card> : payments.map(pay => (
              <Card key={pay.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-green-500" />
                      <span className="font-semibold text-sm text-green-600">{formatCurrency(Number(pay.amount))}</span>
                      <Badge variant="outline" className="text-[10px]">{{ cash: 'Tiền mặt', transfer: 'Chuyển khoản', other: 'Khác' }[pay.payment_method]}</Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="w-3 h-3" />
                      {format(new Date(pay.payment_date), 'dd/MM/yyyy')}
                    </div>
                  </div>
                  {pay.note && <p className="text-xs text-muted-foreground mt-2">{pay.note}</p>}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
