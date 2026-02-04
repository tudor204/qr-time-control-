export enum UserRole {
  EMPLOYEE = 'EMPLOYEE',
  ADMIN = 'ADMIN'
}

export enum RecordType {
  IN = 'IN',
  OUT = 'OUT'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  vacations?: { id: string; start: string; end: string }[]; // Array de objetos con fechas
  weeklyHours?: number; // Número de horas semanales
}

export interface AttendanceRecord {
  id?: string;        // Opcional (?) porque Firebase lo genera después
  userId: string;
  userName: string;
  timestamp: string;
  type: RecordType;
  location: string;   // Cambiado de locationCode a location para que coincida con tu dbService
}

export interface AuthState {
  user: User | null;
  loading: boolean;
}

export interface AdminSettings {
  primaryColor: string;
  layoutDensity: 'compact' | 'spacious';
  showSummary: boolean;
}

