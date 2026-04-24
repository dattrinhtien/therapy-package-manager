// ============================================
// Database Types for Therapy Package Manager
// ============================================

export interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

export interface Patient {
  id: string;
  owner_id: string;
  patient_code: string;
  full_name: string;
  gender: 'male' | 'female' | 'other' | null;
  date_of_birth: string | null;
  phone: string | null;
  address: string | null;
  occupation: string | null;
  medical_history: string | null;
  main_symptoms: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Service {
  id: string;
  owner_id: string;
  name: string;
  category: string | null;
  description: string | null;
  default_price: number;
  default_sessions: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type PackageStatus = 'active' | 'completed' | 'paused' | 'cancelled';

export interface TherapyPackage {
  id: string;
  owner_id: string;
  patient_id: string;
  service_id: string;
  package_name: string;
  total_sessions: number;
  used_sessions: number;
  remaining_sessions: number;
  start_date: string;
  expected_end_date: string | null;
  status: PackageStatus;
  total_amount: number;
  paid_amount: number;
  debt_amount: number;
  treatment_note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Joined fields
  patient?: Patient;
  service?: Service;
}

export type AppointmentStatus = 'scheduled' | 'completed' | 'no_show' | 'cancelled';

export interface Appointment {
  id: string;
  owner_id: string;
  patient_id: string;
  therapy_package_id: string | null;
  service_id: string | null;
  appointment_date: string;
  appointment_time: string | null;
  status: AppointmentStatus;
  treatment_content: string | null;
  next_appointment_date: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Joined fields
  patient?: Patient;
  therapy_package?: TherapyPackage;
  service?: Service;
}

export type PaymentMethod = 'cash' | 'transfer' | 'other';

export interface Payment {
  id: string;
  owner_id: string;
  patient_id: string;
  therapy_package_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  patient?: Patient;
  therapy_package?: TherapyPackage;
}

// Dashboard stats
export interface DashboardStats {
  totalPatients: number;
  newPatientsThisMonth: number;
  activePackages: number;
  todayAppointments: number;
  patientsWithDebt: number;
  monthlyRevenue: number;
  totalDebt: number;
  monthlyCompletedSessions: number;
}
