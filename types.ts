
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
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  timestamp: string;
  type: RecordType;
  locationCode: string;
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
