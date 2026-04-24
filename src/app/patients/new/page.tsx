'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function NewPatientPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '', gender: '', date_of_birth: '', phone: '',
    address: '', occupation: '', medical_history: '',
    main_symptoms: '', note: '',
  });

  const updateField = (field: string, value: string | null) => {
    setForm(prev => ({ ...prev, [field]: value || '' }));
  };

  const generatePatientCode = () => {
    const now = new Date();
    return `BN${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error('Vui lòng nhập họ tên bệnh nhân');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Phiên đăng nhập hết hạn'); setLoading(false); return; }

    const { error } = await supabase.from('patients').insert({
      owner_id: user.id,
      patient_code: generatePatientCode(),
      full_name: form.full_name.trim(),
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      phone: form.phone || null,
      address: form.address || null,
      occupation: form.occupation || null,
      medical_history: form.medical_history || null,
      main_symptoms: form.main_symptoms || null,
      note: form.note || null,
    });

    if (error) {
      toast.error('Lỗi: ' + error.message);
      setLoading(false);
    } else {
      toast.success('Thêm bệnh nhân thành công!');
      router.push('/patients');
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/patients">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Thêm bệnh nhân mới</h1>
            <p className="text-sm text-muted-foreground">Nhập thông tin bệnh nhân</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-base">Thông tin cá nhân</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Họ và tên <span className="text-red-500">*</span></Label>
                  <Input id="full_name" placeholder="Nguyễn Văn A" value={form.full_name} onChange={e => updateField('full_name', e.target.value)} required className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label>Giới tính</Label>
                  <Select value={form.gender} onValueChange={v => updateField('gender', v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Chọn giới tính" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Nam</SelectItem>
                      <SelectItem value="female">Nữ</SelectItem>
                      <SelectItem value="other">Khác</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Ngày sinh</Label>
                  <Input id="date_of_birth" type="date" value={form.date_of_birth} onChange={e => updateField('date_of_birth', e.target.value)} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Số điện thoại</Label>
                  <Input id="phone" placeholder="0901234567" value={form.phone} onChange={e => updateField('phone', e.target.value)} className="h-11" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Địa chỉ</Label>
                  <Input id="address" placeholder="TP. Hồ Chí Minh" value={form.address} onChange={e => updateField('address', e.target.value)} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="occupation">Nghề nghiệp</Label>
                  <Input id="occupation" placeholder="Nhân viên văn phòng" value={form.occupation} onChange={e => updateField('occupation', e.target.value)} className="h-11" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-base">Thông tin y tế</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="medical_history">Tiền sử bệnh</Label>
                <Textarea id="medical_history" placeholder="Mô tả tiền sử bệnh..." value={form.medical_history} onChange={e => updateField('medical_history', e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="main_symptoms">Triệu chứng chính</Label>
                <Textarea id="main_symptoms" placeholder="Mô tả triệu chứng..." value={form.main_symptoms} onChange={e => updateField('main_symptoms', e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Ghi chú</Label>
                <Textarea id="note" placeholder="Ghi chú thêm..." value={form.note} onChange={e => updateField('note', e.target.value)} rows={2} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Link href="/patients"><Button variant="outline" type="button">Hủy</Button></Link>
            <Button type="submit" disabled={loading} className="bg-gradient-to-r from-teal-500 to-cyan-600">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Đang lưu...</> : <><Save className="w-4 h-4 mr-2" />Lưu bệnh nhân</>}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
