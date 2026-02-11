import { User, AttendanceRecord, RecordType, Absence } from '../types';

/**
 * Verifica si un empleado está actualmente de vacaciones
 */
export const isCurrentlyOnVacation = (emp: User): boolean => {
    if (!emp.vacations) return false;
    const today = new Date().toISOString().split('T')[0];
    return emp.vacations.some(v => today >= v.start && today <= v.end);
};

/**
 * Verifica si un empleado está ausente hoy
 */
export const isAbsentToday = (userId: string, absences: Absence[]): Absence | undefined => {
    const today = new Date().toISOString().split('T')[0];
    return absences.find(a => a.userId === userId && a.date === today);
};

/**
 * Obtiene el estado actual de un empleado (Trabajando, Inactivo, De Vacaciones, Ausente)
 */
export const getEmployeeStatus = (emp: User, records: AttendanceRecord[], absences: Absence[] = []) => {
    if (isCurrentlyOnVacation(emp)) {
        return {
            label: 'De Vacaciones',
            color: 'text-orange-500',
            bg: 'bg-orange-50',
            border: 'border-orange-200',
            icon: '🏝️'
        };
    }

    const absence = isAbsentToday(emp.id, absences);
    if (absence) {
        return {
            label: 'Ausente',
            color: 'text-red-500',
            bg: 'bg-red-50',
            border: 'border-red-200',
            icon: '🗓️'
        };
    }

    // Check if active
    const userRecs = records.filter(r => r.userId === emp.id);
    const lastRec = userRecs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    const isActive = lastRec && lastRec.type === RecordType.IN;

    if (isActive) {
        return {
            label: 'Trabajando',
            color: 'text-green-600',
            bg: 'bg-green-50',
            border: 'border-green-200',
            icon: '🟢'
        };
    }

    return {
        label: 'Inactivo',
        color: 'text-gray-400',
        bg: 'bg-white',
        border: 'border-gray-100',
        icon: '🔴'
    };
};
