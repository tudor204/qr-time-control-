import { AttendanceRecord, User } from '../types';
import { calculateDurationHours } from './timeCalculations';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Filtra registros por rango de fechas
 */
export const filterRecordsByDateRange = (
    records: AttendanceRecord[],
    startDate: string,
    endDate: string
): AttendanceRecord[] => {
    if (!startDate || !endDate) return records;

    const start = new Date(startDate).setHours(0, 0, 0, 0);
    const end = new Date(endDate).setHours(23, 59, 59, 999);

    return records.filter(record => {
        const recordDate = new Date(record.timestamp).getTime();
        return recordDate >= start && recordDate <= end;
    });
};

/**
 * Agrupa registros por mes
 */
export const groupRecordsByMonth = (records: AttendanceRecord[]) => {
    const monthGroups: { [key: string]: AttendanceRecord[] } = {};

    records.forEach(record => {
        const date = new Date(record.timestamp);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthGroups[monthKey]) {
            monthGroups[monthKey] = [];
        }
        monthGroups[monthKey].push(record);
    });

    return monthGroups;
};

/**
 * Calcula estadísticas mensuales
 */
export const calculateMonthlyStats = (records: AttendanceRecord[]) => {
    const monthGroups = groupRecordsByMonth(records);
    const stats: any[] = [];

    Object.keys(monthGroups).sort().reverse().forEach(monthKey => {
        const monthRecords = monthGroups[monthKey];
        const [year, month] = monthKey.split('-');

        // Agrupar por día para calcular horas
        const dayGroups: { [key: string]: { in?: string; out?: string } } = {};
        monthRecords.forEach(rec => {
            const dateKey = rec.timestamp.split('T')[0];
            if (!dayGroups[dateKey]) dayGroups[dateKey] = {};

            if (rec.type === 'IN') dayGroups[dateKey].in = rec.timestamp;
            if (rec.type === 'OUT') dayGroups[dateKey].out = rec.timestamp;
        });

        const days = Object.values(dayGroups);
        const totalHours = days.reduce((acc, day) => {
            return acc + calculateDurationHours(day.in, day.out);
        }, 0);

        const daysWorked = days.filter(d => d.in && d.out).length;
        const avgHoursPerDay = daysWorked > 0 ? totalHours / daysWorked : 0;

        stats.push({
            monthKey,
            year,
            month,
            monthName: new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('es-ES', { month: 'long' }),
            totalHours: totalHours.toFixed(2),
            daysWorked,
            avgHoursPerDay: avgHoursPerDay.toFixed(2),
            records: monthRecords
        });
    });

    return stats;
};

/**
 * Genera PDF detallado de registros filtrados
 */
export const generateDetailedPDF = (
    records: AttendanceRecord[],
    employeeName: string,
    startDate: string,
    endDate: string
) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text('Reporte de Asistencia', 14, 22);

    doc.setFontSize(10);
    doc.text(`Empleado: ${employeeName}`, 14, 32);
    doc.text(`Periodo: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`, 14, 38);
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, 14, 44);

    // Agrupar por día
    const dayGroups: { [key: string]: { in?: string; out?: string; hours: number } } = {};
    records.forEach(rec => {
        const dateKey = rec.timestamp.split('T')[0];
        if (!dayGroups[dateKey]) dayGroups[dateKey] = { hours: 0 };

        if (rec.type === 'IN') dayGroups[dateKey].in = rec.timestamp;
        if (rec.type === 'OUT') dayGroups[dateKey].out = rec.timestamp;
    });

    // Calcular horas
    Object.keys(dayGroups).forEach(dateKey => {
        const day = dayGroups[dateKey];
        day.hours = calculateDurationHours(day.in, day.out);
    });

    const totalHours = Object.values(dayGroups).reduce((acc, day) => acc + day.hours, 0);

    // Table
    const tableData = Object.keys(dayGroups).sort().map(dateKey => {
        const day = dayGroups[dateKey];
        return [
            new Date(dateKey).toLocaleDateString('es-ES'),
            day.in ? new Date(day.in).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--',
            day.out ? new Date(day.out).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--',
            `${day.hours.toFixed(2)}h`
        ];
    });

    autoTable(doc, {
        startY: 55,
        head: [['Fecha', 'Entrada', 'Salida', 'Horas']],
        body: tableData,
        foot: [['', '', 'TOTAL:', `${totalHours.toFixed(2)}h`]],
        theme: 'striped'
    });

    doc.save(`Reporte_${employeeName.replace(/\s+/g, '_')}_${startDate}_${endDate}.pdf`);
};

/**
 * Genera PDF de resumen mensual
 */
export const generateMonthlyPDF = (
    monthStats: any,
    employeeName: string
) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text(`Resumen Mensual - ${monthStats.monthName} ${monthStats.year}`, 14, 22);

    doc.setFontSize(10);
    doc.text(`Empleado: ${employeeName}`, 14, 32);
    doc.text(`Total de horas: ${monthStats.totalHours}h`, 14, 38);
    doc.text(`Días trabajados: ${monthStats.daysWorked}`, 14, 44);
    doc.text(`Promedio por día: ${monthStats.avgHoursPerDay}h`, 14, 50);
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, 14, 56);

    // Agrupar por día
    const dayGroups: { [key: string]: { in?: string; out?: string; hours: number } } = {};
    monthStats.records.forEach((rec: AttendanceRecord) => {
        const dateKey = rec.timestamp.split('T')[0];
        if (!dayGroups[dateKey]) dayGroups[dateKey] = { hours: 0 };

        if (rec.type === 'IN') dayGroups[dateKey].in = rec.timestamp;
        if (rec.type === 'OUT') dayGroups[dateKey].out = rec.timestamp;
    });

    // Calcular horas
    Object.keys(dayGroups).forEach(dateKey => {
        const day = dayGroups[dateKey];
        day.hours = calculateDurationHours(day.in, day.out);
    });

    // Table
    const tableData = Object.keys(dayGroups).sort().map(dateKey => {
        const day = dayGroups[dateKey];
        return [
            new Date(dateKey).toLocaleDateString('es-ES'),
            day.in ? new Date(day.in).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--',
            day.out ? new Date(day.out).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--',
            `${day.hours.toFixed(2)}h`
        ];
    });

    autoTable(doc, {
        startY: 68,
        head: [['Fecha', 'Entrada', 'Salida', 'Horas']],
        body: tableData,
        theme: 'striped'
    });

    doc.save(`Resumen_${employeeName.replace(/\s+/g, '_')}_${monthStats.monthKey}.pdf`);
};
