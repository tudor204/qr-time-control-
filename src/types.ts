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
  vacations?: { id: string; start: string; end: string }[];
  weeklyHours?: number;
  workingDaysPerWeek?: number;
  totalVacationDays?: number;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface Absence {
  id?: string;
  userId: string;
  date: string;
  predefinedReason: string;
  customReason?: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id?: string;
  userId: string;
  userName: string;
  timestamp: string;
  type: RecordType;
  location: string;
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

