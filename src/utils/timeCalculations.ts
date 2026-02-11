import { User, AttendanceRecord, RecordType, Absence } from '../types';

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
 * Calcula las estadísticas semanales de un empleado considerando ausencias
 */
export const getWeeklyStats = (emp: User, records: AttendanceRecord[], isOnVacation: boolean, absences: Absence[] = []) => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 (Dom) a 6 (Sab)
    // Ajustamos para que la semana empiece el Lunes (0)
    const diffToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);

    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const groups = getGroupedRecords(emp.id, records);

    // Filtrar registros de la semana actual (Lunes a Domingo)
    const totalHours = groups
        .filter((g: any) => {
            const d = new Date(g.date);
            return d >= monday && d <= sunday;
        })
        .reduce((acc, curr: any) => acc + calculateDurationHours(curr.in, curr.out), 0);

    // Contar ausencias de la semana actual
    const weeklyAbsences = absences.filter(a => {
        const d = new Date(a.date);
        return d >= monday && d <= sunday;
    }).length;

    const workingDaysPerWeek = emp.workingDaysPerWeek || 5;
    const baseWeeklyHours = emp.weeklyHours || 40;

    // Cálculo proporcional: (Horas / Días) * (Días - Ausencias)
    let target = isOnVacation ? 0 : baseWeeklyHours;
    if (!isOnVacation && weeklyAbsences > 0) {
        const hoursPerDay = baseWeeklyHours / workingDaysPerWeek;
        const remainingWorkingDays = Math.max(0, workingDaysPerWeek - weeklyAbsences);
        target = hoursPerDay * remainingWorkingDays;
    }

    return {
        total: totalHours.toFixed(1),
        target: target.toFixed(1),
        percent: target === 0 ? 100 : Math.min((totalHours / target) * 100, 100),
        onVacation: isOnVacation,
        absentDays: weeklyAbsences
    };
};
