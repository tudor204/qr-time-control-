import { AttendanceRecord, RecordType } from '../types';

export type IncidentType = 'MISSING_OUT' | 'DOUBLE_IN' | 'OUT_WITHOUT_IN';
export interface IncidentResult {
    status: 'OK' | 'INCIDENT';
    type?: IncidentType;
}

/**
 * Detecta si, dentro de un conjunto de registros (normalmente de un usuario), existe
 * al menos un turno abierto (entrada sin salida) para el día corriente.
 *
 * @param records lista completa de AttendanceRecord del empleado
 * @returns true si hay un "turno abierto" para el día de hoy
 */
export const detectOpenShift = (records: AttendanceRecord[]): boolean => {
    if (!records || records.length === 0) return false;

    const todayKey = new Date().toISOString().split('T')[0];
    const todays = records
        .filter(r => r.timestamp.startsWith(todayKey))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (todays.length === 0) return false;
    const last = todays[0];
    return last.type === RecordType.IN;
};

/**
 * Analiza un conjunto de registros y devuelve el primer incidente detectado.
 * Se comprueba por día los casos:
 *   - IN sin OUT (MISSING_OUT)
 *   - más de una IN (DOUBLE_IN)
 *   - OUT sin IN (OUT_WITHOUT_IN)
 *
 * La función está pensada para uso general, puede aplicarse tanto a un día
 * concreto como a todo el histórico y devolverá el primer fallo encontrado.
 */
export const analyzeAttendanceIncidents = (records: AttendanceRecord[]): IncidentResult => {
    const byDay: { [date: string]: AttendanceRecord[] } = {};
    records.forEach(r => {
        const d = r.timestamp.split('T')[0];
        if (!byDay[d]) byDay[d] = [];
        byDay[d].push(r);
    });

    for (const day in byDay) {
        const dayRecs = byDay[day].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        let ins = 0;
        let outs = 0;
        dayRecs.forEach(r => {
            if (r.type === RecordType.IN) ins++;
            if (r.type === RecordType.OUT) outs++;
        });
        if (ins === 0 && outs > 0) return { status: 'INCIDENT', type: 'OUT_WITHOUT_IN' };
        if (ins > 1) return { status: 'INCIDENT', type: 'DOUBLE_IN' };
        if (ins === 1 && outs === 0) return { status: 'INCIDENT', type: 'MISSING_OUT' };
    }

    return { status: 'OK' };
};

/**
 * Devuelve una copia de los registros marcando como 'MISSING_OUT' aquellos
 * que llevan más de `thresholdHours` horas abiertos.
 *
 * Nota: esta función NO modifica firestore; sólo sirve para calcular estados
 * provisionales en la UI o para programar una actualización posterior.
 */
export const flagStaleShifts = (
    records: AttendanceRecord[],
    thresholdHours = 12
): AttendanceRecord[] => {
    const now = Date.now();
    return records.map(r => {
        if (r.type === RecordType.IN && (!r.status || r.status === 'NORMAL')) {
            const diff = now - new Date(r.timestamp).getTime();
            if (diff >= thresholdHours * 3600000) {
                return { ...r, status: 'MISSING_OUT' };
            }
        }
        return r;
    });
};
