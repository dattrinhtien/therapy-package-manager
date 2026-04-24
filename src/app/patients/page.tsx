'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';
import type { Patient } from '@/lib/types';
import { format } from 'date-fns';

export default function PatientsPage() {
  const supabase = createClient();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPatients = async () => {
      setLoading(true);
      let query = supabase.from('patients').select('*').is('deleted_at', null).order('created_at', { ascending: false });

      if (search.trim()) {
        query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,patient_code.ilike.%${search}%`);
      }

      const { data } = await query;
      setPatients((data || []) as Patient[]);
      setLoading(false);
    };
    loadPatients();
  }, [supabase, search]);

  const genderLabels: Record<string, string> = { male: 'Nam', female: 'Nữ', other: 'Khác' };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Bệnh nhân</h1>
            <p className="text-sm text-muted-foreground">Quản lý danh sách bệnh nhân</p>
          </div>
          <Link href="/patients/new">
            <Button className="bg-gradient-to-r from-teal-500 to-cyan-600 shadow-lg shadow-teal-500/25">
              <Plus className="w-4 h-4 mr-2" /> Thêm bệnh nhân
            </Button>
          </Link>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, SĐT, mã BN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
          </div>
        ) : patients.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {search ? 'Không tìm thấy bệnh nhân phù hợp' : 'Chưa có bệnh nhân nào'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {patients.map((p) => (
              <Link key={p.id} href={`/patients/${p.id}`}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:-translate-y-0.5">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center text-teal-700 font-bold text-sm shrink-0">
                          {p.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm">{p.full_name}</p>
                            <Badge variant="secondary" className="text-[10px]">{p.patient_code}</Badge>
                            {p.gender && (
                              <Badge variant="outline" className="text-[10px]">{genderLabels[p.gender] || p.gender}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1">
                            {p.phone && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="w-3 h-3" />{p.phone}
                              </span>
                            )}
                            {p.address && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="w-3 h-3" />{p.address}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground sm:text-right">
                        {format(new Date(p.created_at), 'dd/MM/yyyy')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
