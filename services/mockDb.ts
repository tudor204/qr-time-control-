
import { User, UserRole, AttendanceRecord, RecordType } from '../types';

const INITIAL_USERS: User[] = [
  { id: 'admin-001', name: 'Admin Central', email: 'admin@example.com', role: UserRole.ADMIN },
  { id: 'emp-001', name: 'Demo Employee', email: 'employee@example.com', role: UserRole.EMPLOYEE },
];

const STORAGE_USERS_KEY = 'access_control_users_v1';
const STORAGE_RECORDS_KEY = 'access_control_records_v1';
const STORAGE_OFFLINE_KEY = 'access_control_offline_v1';

const getStoredUsers = (): User[] => {
  const stored = localStorage.getItem(STORAGE_USERS_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(INITIAL_USERS));
    return INITIAL_USERS;
  }
  return JSON.parse(stored);
};

const getStoredRecords = (): AttendanceRecord[] => {
  const stored = localStorage.getItem(STORAGE_RECORDS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const getOfflineQueue = (): AttendanceRecord[] => {
  const stored = localStorage.getItem(STORAGE_OFFLINE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const mockDb = {
  isOnline: (): boolean => navigator.onLine,

  login: async (email: string): Promise<User | null> => {
    const users = getStoredUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
  },

  register: async (name: string, email: string): Promise<User | { error: string }> => {
    const users = getStoredUsers();
    const normalizedEmail = email.toLowerCase().trim();
    if (users.find(u => u.email.toLowerCase() === normalizedEmail)) {
      return { error: 'Este correo ya está registrado en la base de datos.' };
    }
    const newUser: User = {
      id: `usr-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      email: normalizedEmail,
      role: UserRole.EMPLOYEE
    };
    users.push(newUser);
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    return newUser;
  },

  deleteEmployee: async (userId: string): Promise<boolean> => {
    let users = getStoredUsers();
    users = users.filter(u => u.id !== userId);
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    
    let records = getStoredRecords();
    records = records.filter(r => r.userId !== userId);
    localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(records));
    return true;
  },
  
  getRecords: async (userId?: string): Promise<AttendanceRecord[]> => {
    const records = getStoredRecords();
    const offline = getOfflineQueue();
    const combined = [...records, ...offline];
    const filtered = userId ? combined.filter(r => r.userId === userId) : combined;
    return filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },

  addRecord: async (userId: string, userName: string, locationCode: string): Promise<AttendanceRecord> => {
    const records = getStoredRecords();
    const offline = getOfflineQueue();
    const combined = [...records, ...offline];
    
    const userHistory = combined.filter(r => r.userId === userId).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    
    const lastRecord = userHistory[0];
    const isToday = lastRecord && new Date(lastRecord.timestamp).toDateString() === new Date().toDateString();
    const nextType = (isToday && lastRecord.type === RecordType.IN) ? RecordType.OUT : RecordType.IN;
    
    const newRecord: AttendanceRecord = {
      id: `rec-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      userName,
      timestamp: new Date().toISOString(),
      type: nextType,
      locationCode
    };

    if (navigator.onLine) {
      records.push(newRecord);
      localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(records));
    } else {
      offline.push(newRecord);
      localStorage.setItem(STORAGE_OFFLINE_KEY, JSON.stringify(offline));
    }
    
    return newRecord;
  },

  syncOfflineRecords: async (): Promise<number> => {
    const offline = getOfflineQueue();
    if (offline.length === 0) return 0;
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const records = getStoredRecords();
    const syncedCount = offline.length;
    
    const newRecords = [...records, ...offline];
    localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(newRecords));
    localStorage.removeItem(STORAGE_OFFLINE_KEY);
    
    return syncedCount;
  },

  getOfflineCount: (): number => getOfflineQueue().length,

  getEmployees: async (): Promise<User[]> => {
    return getStoredUsers().filter(u => u.role === UserRole.EMPLOYEE);
  }
};
