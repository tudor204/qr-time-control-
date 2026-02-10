import { User, AttendanceRecord, RecordType } from '../types';

/**
 * Verifica si un empleado está actualmente de vacaciones
 */
export const isCurrentlyOnVacation = (emp: User): boolean => {
    if (!emp.vacations) return false;
    const today = new Date().toISOString().split('T')[0];
    return emp.vacations.some(v => today >= v.start && today <= v.end);
};

/**
 * Obtiene el estado actual de un empleado (Trabajando, Inactivo, De Vacaciones)
 */
export const getEmployeeStatus = (emp: User, records: AttendanceRecord[]) => {
    if (isCurrentlyOnVacation(emp)) {
        return {
            label: 'De Vacaciones',
            color: 'text-orange-500',
            bg: 'bg-orange-50',
            border: 'border-orange-200',
            icon: '🏝️'
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
