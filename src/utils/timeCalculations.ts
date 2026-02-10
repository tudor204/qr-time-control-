import { User, AttendanceRecord, RecordType } from '../types';

/**
 * Calcula la duración en horas entre dos timestamps
 */
export const calculateDurationHours = (inTime?: string, outTime?: string): number => {
    if (!inTime || !outTime) return 0;
    return (new Date(outTime).getTime() - new Date(inTime).getTime()) / 3600000;
};

/**
 * Formatea una duración en horas a formato "Xh Ym"
 */
export const formatDuration = (hoursFloat: number): string => {
    const h = Math.floor(hoursFloat);
    const m = Math.floor((hoursFloat - h) * 60);
    return h > 0 || m > 0 ? `${h}h ${m}m` : 'En curso...';
};

/**
 * Agrupa los registros de asistencia por día
 */
export const getGroupedRecords = (userId: string, records: AttendanceRecord[]) => {
    const userRecs = records.filter(r => r.userId === userId);
    const groups: { [key: string]: any } = {};
    userRecs.forEach(rec => {
        const dateKey = rec.timestamp.split('T')[0];
        if (!groups[dateKey]) groups[dateKey] = { date: dateKey, in: null, out: null };
        if (rec.type === RecordType.IN) groups[dateKey].in = rec.timestamp;
        if (rec.type === RecordType.OUT) groups[dateKey].out = rec.timestamp;
    });
    return Object.values(groups).sort((a: any, b: any) => b.date.localeCompare(a.date));
};

/**
 * Calcula las estadísticas semanales de un empleado
 */
export const getWeeklyStats = (emp: User, records: AttendanceRecord[], isOnVacation: boolean) => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const groups = getGroupedRecords(emp.id, records);
    const totalHours = groups
        .filter((g: any) => new Date(g.date) >= oneWeekAgo)
        .reduce((acc, curr: any) => acc + calculateDurationHours(curr.in, curr.out), 0);
    const onVacation = isOnVacation;
    const target = onVacation ? 0 : (emp.weeklyHours || 40);
    return { total: totalHours.toFixed(1), target, percent: target === 0 ? 100 : Math.min((totalHours / target) * 100, 100), onVacation };
};
