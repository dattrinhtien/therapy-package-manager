'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Loader2, Stethoscope } from 'lucide-react';
import type { Service } from '@/lib/types';
import { toast } from 'sonner';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

const emptyForm = { name: '', category: '', description: '', default_price: '', default_sessions: '5' };

export default function ServicesPage() {
  const supabase = createClient();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadServices = async () => {
    const { data } = await supabase.from('services').select('*').is('deleted_at', null).order('created_at', { ascending: false });
    setServices((data || []) as Service[]);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const updateField = (field: string, value: string | null) => setForm(prev => ({ ...prev, [field]: value || '' }));

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (s: Service) => {
    setEditingId(s.id);
    setForm({ name: s.name, category: s.category || '', description: s.description || '', default_price: String(s.default_price), default_sessions: String(s.default_sessions) });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Tên dịch vụ không được trống'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Phiên hết hạn'); setSaving(false); return; }

    const payload = {
      name: form.name.trim(),
      category: form.category || null,
      description: form.description || null,
      default_price: parseFloat(form.default_price) || 0,
      default_sessions: parseInt(form.default_sessions) || 5,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase.from('services').update(payload).eq('id', editingId);
      if (error) toast.error('Lỗi: ' + error.message); else toast.success('Cập nhật thành công');
    } else {
      const { error } = await supabase.from('services').insert({ ...payload, owner_id: user.id, is_active: true });
      if (error) toast.error('Lỗi: ' + error.message); else toast.success('Thêm dịch vụ thành công');
    }
    setSaving(false); setDialogOpen(false); loadServices();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa dịch vụ này?')) return;
    const { error } = await supabase.from('services').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) toast.error('Lỗi: ' + error.message); else { toast.success('Đã xóa dịch vụ'); loadServices(); }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h1 className="text-2xl font-bold">Dịch vụ trị liệu</h1><p className="text-sm text-muted-foreground">Quản lý các dịch vụ tại phòng trị liệu</p></div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button onClick={openAdd} className="bg-gradient-to-r from-teal-500 to-cyan-600 shadow-lg shadow-teal-500/25"><Plus className="w-4 h-4 mr-2" />Thêm dịch vụ</Button>} />
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? 'Sửa dịch vụ' : 'Thêm dịch vụ mới'}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2"><Label>Tên dịch vụ *</Label><Input placeholder="VD: Cổ vai gáy" value={form.name} onChange={e => updateField('name', e.target.value)} /></div>
                <div className="space-y-2"><Label>Nhóm dịch vụ</Label><Input placeholder="VD: Xương khớp" value={form.category} onChange={e => updateField('category', e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Giá mỗi buổi (VNĐ)</Label><Input type="number" placeholder="500000" value={form.default_price} onChange={e => updateField('default_price', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Số buổi mặc định</Label><Input type="number" placeholder="5" value={form.default_sessions} onChange={e => updateField('default_sessions', e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Mô tả</Label><Textarea placeholder="Mô tả dịch vụ..." value={form.description} onChange={e => updateField('description', e.target.value)} rows={2} /></div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
                  <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-teal-500 to-cyan-600">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}{saving ? 'Đang lưu...' : 'Lưu'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div>
        ) : services.length === 0 ? (
          <Card className="border-0 shadow-md"><CardContent className="py-12 text-center text-muted-foreground">Chưa có dịch vụ nào</CardContent></Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map(s => (
              <Card key={s.id} className="border-0 shadow-sm hover:shadow-md transition-all duration-200">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center">
                        <Stethoscope className="w-5 h-5 text-teal-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{s.name}</p>
                        {s.category && <Badge variant="outline" className="text-[10px] mt-0.5">{s.category}</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Edit className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => handleDelete(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                  {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-teal-600">{formatCurrency(Number(s.default_price))}/buổi</span>
                    <span className="text-muted-foreground text-xs">{s.default_sessions} buổi mặc định</span>
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
