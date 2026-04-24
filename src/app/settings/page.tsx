'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Save, User } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || '');
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
        if (profile) setFullName(profile.full_name || '');
      }
      setLoading(false);
    })();
  }, [supabase]);

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Phiên hết hạn'); setSaving(false); return; }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: fullName,
    });
    if (error) toast.error('Lỗi: ' + error.message);
    else toast.success('Cập nhật thành công');
    setSaving(false);
  };

  if (loading) {
    return <AppShell><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div></AppShell>;
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Cài đặt</h1>
          <p className="text-sm text-muted-foreground">Quản lý thông tin tài khoản</p>
        </div>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center">
                <User className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <CardTitle className="text-base">Thông tin cá nhân</CardTitle>
                <CardDescription>Cập nhật tên hiển thị của bạn</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} disabled className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Họ và tên</Label>
              <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nhập họ tên" className="h-11" />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-teal-500 to-cyan-600">
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Đang lưu...</> : <><Save className="w-4 h-4 mr-2" />Lưu thay đổi</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-base">Thông tin ứng dụng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong>Tên:</strong> Quản lý gói trị liệu</p>
            <p><strong>Phiên bản:</strong> 1.0.0 (MVP)</p>
            <p><strong>Công nghệ:</strong> Next.js, Supabase, Tailwind CSS</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
