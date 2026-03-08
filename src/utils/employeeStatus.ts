import { User, AttendanceRecord, Absence } from '../types';
import { detectOpenShift, analyzeAttendanceIncidents } from './attendanceUtils';

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
            icon: '🏝️',
            reason: 'Vacaciones'
        };
    }

    const absence = isAbsentToday(emp.id, absences);
    if (absence) {
        return {
            label: 'Ausente',
            color: 'text-red-500',
            bg: 'bg-red-50',
            border: 'border-red-200',
            icon: '🗓️',
            reason: absence.predefinedReason === 'Otro' ? absence.customReason : absence.predefinedReason
        };
    }

    // Check daily state using helper utilities
    const userRecs = records.filter(r => r.userId === emp.id);

    // si hay algún incidente evidente, mostramos alerta
    const incident = analyzeAttendanceIncidents(userRecs);
    if (incident.status === 'INCIDENT') {
        // etiquetas sencillas; la UI puede ampliarlas si hace falta
        let label = 'Incidencia';
        if (incident.type === 'MISSING_OUT') label = 'Falta salida';
        if (incident.type === 'DOUBLE_IN') label = 'Entrada duplicada';
        if (incident.type === 'OUT_WITHOUT_IN') label = 'Salida sin entrada';
        return {
            label,
            color: 'text-yellow-600',
            bg: 'bg-yellow-50',
            border: 'border-yellow-200',
            icon: '⚠️',
            reason: incident.type
        };
    }

    // finally detect open shift (works same day)
    const hasOpen = detectOpenShift(userRecs);
    if (hasOpen) {
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

/**
 * Comprueba si hay un turno abierto en el histórico de registros.
 * Se reexporta para uso en otros módulos (por ejemplo, alerta al iniciar la app).
 */
export { detectOpenShift };
