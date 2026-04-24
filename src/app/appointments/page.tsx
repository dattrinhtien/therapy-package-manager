'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Loader2, CalendarDays, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { Appointment, Patient, TherapyPackage, Service } from '@/lib/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const statusLabels: Record<string, string> = { scheduled: 'Đã đặt lịch', completed: 'Đã đến', no_show: 'Không đến', cancelled: 'Đã hủy' };
const statusColors: Record<string, string> = { scheduled: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', no_show: 'bg-red-100 text-red-700', cancelled: 'bg-gray-100 text-gray-500' };

export default function AppointmentsPage() {
  const supabase = createClient();
  const [appointments, setAppointments] = useState<(Appointment & { patient?: Patient; service?: Service; therapy_package?: TherapyPackage })[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientPackages, setPatientPackages] = useState<(TherapyPackage & { service?: Service })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [form, setForm] = useState({
    patient_id: '', therapy_package_id: '', service_id: '',
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: '08:00', note: '',
  });

  const loadAppointments = async () => {
    const { data } = await supabase.from('appointments')
      .select('*, patient:patients(id,full_name,patient_code,phone), service:services(id,name), therapy_package:therapy_packages(id,package_name,used_sessions,total_sessions,remaining_sessions,status)')
      .eq('appointment_date', selectedDate)
      .is('deleted_at', null)
      .order('appointment_time', { ascending: true });
    setAppointments((data || []) as (Appointment & { patient?: Patient; service?: Service; therapy_package?: TherapyPackage })[]);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    const loadPatients = async () => {
      const { data } = await supabase.from('patients').select('id,full_name,patient_code').is('deleted_at', null).order('full_name');
      setPatients((data || []) as Patient[]);
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAppointments();
    loadPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, selectedDate]);

  const loadPatientPackages = async (patientId: string) => {
    const { data } = await supabase.from('therapy_packages')
      .select('*, service:services(id,name)')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .is('deleted_at', null);
    setPatientPackages((data || []) as (TherapyPackage & { service?: Service })[]);
  };

  const updateField = (field: string, value: string | null) => {
    const val = value || '';
    setForm(prev => {
      const updated = { ...prev, [field]: val };
      if (field === 'patient_id') {
        loadPatientPackages(val);
        updated.therapy_package_id = '';
        updated.service_id = '';
      }
      if (field === 'therapy_package_id') {
        const pkg = patientPackages.find(p => p.id === val);
        if (pkg?.service) updated.service_id = (pkg.service as unknown as Service).id;
      }
      return updated;
    });
  };

  const handleCreate = async () => {
    if (!form.patient_id) { toast.error('Chọn bệnh nhân'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Phiên hết hạn'); setSaving(false); return; }

    const { error } = await supabase.from('appointments').insert({
      owner_id: user.id,
      patient_id: form.patient_id,
      therapy_package_id: form.therapy_package_id || null,
      service_id: form.service_id || null,
      appointment_date: form.appointment_date,
      appointment_time: form.appointment_time || null,
      status: 'scheduled',
      note: form.note || null,
    });
    if (error) toast.error('Lỗi: ' + error.message);
    else { toast.success('Đặt lịch thành công'); setDialogOpen(false); loadAppointments(); }
    setSaving(false);
  };

  const markAttended = async (appt: Appointment & { therapy_package?: TherapyPackage }) => {
    // Update appointment status
    const { error } = await supabase.from('appointments')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', appt.id);
    if (error) { toast.error('Lỗi: ' + error.message); return; }

    // Update therapy package sessions
    if (appt.therapy_package_id && appt.therapy_package) {
      const pkg = appt.therapy_package;
      const newUsed = Math.min(Number(pkg.used_sessions) + 1, Number(pkg.total_sessions));
      const newRemaining = Number(pkg.total_sessions) - newUsed;
      const newStatus = newRemaining === 0 ? 'completed' : pkg.status;

      await supabase.from('therapy_packages').update({
        used_sessions: newUsed,
        remaining_sessions: newRemaining,
        status: newStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', appt.therapy_package_id);

      if (newRemaining === 0) {
        toast.success('Bệnh nhân đã hoàn thành gói trị liệu!');
      }
    }

    toast.success('Đã đánh dấu đến khám');
    loadAppointments();
  };

  const markNoShow = async (id: string) => {
    const { error } = await supabase.from('appointments')
      .update({ status: 'no_show', updated_at: new Date().toISOString() }).eq('id', id);
    if (error) toast.error('Lỗi: ' + error.message);
    else { toast.success('Đã đánh dấu không đến'); loadAppointments(); }
  };

  const cancelAppt = async (id: string) => {
    const { error } = await supabase.from('appointments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id);
    if (error) toast.error('Lỗi: ' + error.message);
    else { toast.success('Đã hủy lịch hẹn'); loadAppointments(); }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h1 className="text-2xl font-bold">Lịch hẹn</h1><p className="text-sm text-muted-foreground">Quản lý lịch khám và trị liệu</p></div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button className="bg-gradient-to-r from-teal-500 to-cyan-600 shadow-lg shadow-teal-500/25"><Plus className="w-4 h-4 mr-2" />Đặt lịch mới</Button>} />
            <DialogContent>
              <DialogHeader><DialogTitle>Đặt lịch hẹn mới</DialogTitle></DialogHeader>
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
                    <Label>Gói trị liệu</Label>
                    <Select value={form.therapy_package_id} onValueChange={v => updateField('therapy_package_id', v)}>
                      <SelectTrigger><SelectValue placeholder="Chọn gói (không bắt buộc)" /></SelectTrigger>
                      <SelectContent>{patientPackages.map(p => <SelectItem key={p.id} value={p.id}>{(p.service as unknown as Service)?.name || p.package_name} (còn {p.remaining_sessions} buổi)</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Ngày hẹn</Label><Input type="date" value={form.appointment_date} onChange={e => updateField('appointment_date', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Giờ hẹn</Label><Input type="time" value={form.appointment_time} onChange={e => updateField('appointment_time', e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Ghi chú</Label><Textarea placeholder="Ghi chú..." value={form.note} onChange={e => updateField('note', e.target.value)} rows={2} /></div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
                  <Button onClick={handleCreate} disabled={saving} className="bg-gradient-to-r from-teal-500 to-cyan-600">
                    {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Đang lưu...</> : 'Đặt lịch'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Date selector */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <CalendarDays className="w-5 h-5 text-teal-500" />
            <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="max-w-xs" />
            <span className="text-sm text-muted-foreground">
              {format(new Date(selectedDate), "EEEE, dd/MM/yyyy", { locale: vi })}
            </span>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div>
        ) : appointments.length === 0 ? (
          <Card className="border-0 shadow-md"><CardContent className="py-12 text-center text-muted-foreground">Không có lịch hẹn trong ngày này</CardContent></Card>
        ) : (
          <div className="space-y-3">
            <CardHeader className="px-0 pb-2"><CardTitle className="text-base">{appointments.length} lịch hẹn</CardTitle></CardHeader>
            {appointments.map(appt => (
              <Card key={appt.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-teal-50 to-cyan-50 shrink-0">
                        <Clock className="w-4 h-4 text-teal-600 mb-0.5" />
                        <span className="text-xs font-bold text-teal-700">{appt.appointment_time?.slice(0, 5) || '--:--'}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{(appt.patient as unknown as Patient)?.full_name || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">
                          {(appt.service as unknown as Service)?.name || 'Khám chung'}
                          {appt.therapy_package && ` • ${(appt.therapy_package as unknown as TherapyPackage).used_sessions}/${(appt.therapy_package as unknown as TherapyPackage).total_sessions} buổi`}
                        </p>
                        {appt.note && <p className="text-xs text-muted-foreground mt-1">{appt.note}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={statusColors[appt.status]} variant="secondary">{statusLabels[appt.status]}</Badge>
                      {appt.status === 'scheduled' && (
                        <>
                          <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 h-8"
                            onClick={() => markAttended(appt as Appointment & { therapy_package?: TherapyPackage })}>
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />Đã đến
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 h-8"
                            onClick={() => markNoShow(appt.id)}>
                            <XCircle className="w-3.5 h-3.5 mr-1" />Không đến
                          </Button>
                          <Button size="sm" variant="ghost" className="text-gray-500 h-8" onClick={() => cancelAppt(appt.id)}>Hủy</Button>
                        </>
                      )}
                    </div>
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
