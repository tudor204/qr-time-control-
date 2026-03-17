import { AttendanceRecord, Absence } from '../types';
import { calculateDurationHours } from './timeCalculations';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Función helper para guardar y compartir PDF en entorno móvil (Capacitor)
 */
export const saveAndSharePDF = async (doc: jsPDF, filename: string) => {
    const isCapacitor = (window as any).Capacitor?.isNativePlatform();

    if (isCapacitor) {
        try {
            const pdfBase64 = doc.output('datauristring').split(',')[1];

            // Guardar en el directorio de documentos/caché
            const savedFile = await Filesystem.writeFile({
                path: filename,
                data: pdfBase64,
                directory: Directory.Documents
            });

            // Compartir el archivo guardado
            await Share.share({
                title: 'Exportar Reporte PDF',
                text: 'Aquí tienes el reporte de asistencia solicitado.',
                url: savedFile.uri,
                dialogTitle: 'Abrir o Compartir Reporte'
            });
        } catch (error) {
            console.error('Error procesando PDF en móvil:', error);
            alert('No se pudo generar o compartir el PDF. Verifica los permisos.');
        }
    } else {
        doc.save(filename);
    }
};

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
 * Genera PDF detallado de registros filtrados incluyendo vacaciones
 */
export const generateDetailedPDF = async (
    records: AttendanceRecord[],
    employeeName: string,
    startDate: string,
    endDate: string,
    absences: Absence[] = [],
    vacations: { start: string; end: string }[] = []
) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text('Reporte de Asistencia', 14, 22);

    doc.setFontSize(10);
    doc.text(`Empleado: ${employeeName}`, 14, 32);
    doc.text(`Periodo: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`, 14, 38);
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, 14, 44);

    // Agrupar registros por día
    const dayGroups: { [key: string]: { in?: string; out?: string; hours: number; isAbsence?: boolean; isVacation?: boolean; reason?: string } } = {};

    records.forEach(rec => {
        const dateKey = rec.timestamp.split('T')[0];
        if (!dayGroups[dateKey]) dayGroups[dateKey] = { hours: 0 };

        if (rec.type === 'IN') dayGroups[dateKey].in = rec.timestamp;
        if (rec.type === 'OUT') dayGroups[dateKey].out = rec.timestamp;
    });

    // Calcular horas de trabajo
    Object.keys(dayGroups).forEach(dateKey => {
        const day = dayGroups[dateKey];
        day.hours = calculateDurationHours(day.in, day.out);
    });

    // Añadir ausencias a los grupos
    absences.forEach(abs => {
        if (!dayGroups[abs.date]) {
            dayGroups[abs.date] = {
                hours: 0,
                isAbsence: true,
                reason: abs.predefinedReason === 'Otro' ? abs.customReason : abs.predefinedReason
            };
        }
    });

    // Añadir vacaciones a los días sin registros (pero dentro del rango del reporte)
    const current = new Date(startDate);
    const last = new Date(endDate);
    while (current <= last) {
        const dateKey = current.toISOString().split('T')[0];
        const isOnVacation = vacations.some(v => dateKey >= v.start && dateKey <= v.end);
        
        if (isOnVacation && !dayGroups[dateKey]) {
            dayGroups[dateKey] = {
                hours: 0,
                isVacation: true,
                reason: 'VACACIONES'
            };
        }
        current.setDate(current.getDate() + 1);
    }

    const totalHours = Object.values(dayGroups).reduce((acc, day) => acc + day.hours, 0);

    // Table
    const tableData = Object.keys(dayGroups).sort().map(dateKey => {
        const day = dayGroups[dateKey];
        if (day.isAbsence || day.isVacation) {
            const label = day.isVacation ? 'VACACIONES' : `AUSENCIA: ${day.reason}`;
            const color = day.isVacation ? [249, 115, 22] : [239, 68, 68]; // Naranja para vacaciones, rojo para ausencia
            
            return [
                new Date(dateKey).toLocaleDateString('es-ES'),
                { content: label, colSpan: 2, styles: { halign: 'center', fontStyle: 'bold' as any, textColor: color as any } },
                '',
                '0.00h'
            ];
        }
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
        body: tableData as any,
        foot: [['', '', 'TOTAL:', `${totalHours.toFixed(2)}h`]],
        theme: 'striped'
    });

    await saveAndSharePDF(doc, `Reporte_${employeeName.replace(/\s+/g, '_')}_${startDate}_${endDate}.pdf`);
};

/**
 * Genera PDF de resumen mensual
 */
export const generateMonthlyPDF = async (
    monthStats: any,
    employeeName: string,
    absences: Absence[] = [],
    vacations: { start: string; end: string }[] = []
) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text(`Resumen Mensual - ${monthStats.monthName} ${monthStats.year}`, 14, 22);

    doc.setFontSize(10);
    doc.text(`Empleado: ${employeeName}`, 14, 32);
    doc.text(`Total de horas: ${monthStats.totalHours}h`, 14, 38);
    doc.text(`Días trabajados: ${monthStats.daysWorked}`, 14, 44);
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

    // Añadir ausencias
    absences.forEach(abs => {
        if (!dayGroups[abs.date]) {
            dayGroups[abs.date] = {
                hours: 0,
                // @ts-ignore
                isAbsence: true,
                reason: abs.predefinedReason === 'Otro' ? abs.customReason : abs.predefinedReason
            };
        }
    });

    // Añadir vacaciones (dentro del mes del reporte)
    const [year, month] = monthStats.monthKey.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    let current = new Date(startDate);
    while (current <= endDate) {
        const dateKey = current.toISOString().split('T')[0];
        const isOnVacation = vacations.some(v => dateKey >= v.start && dateKey <= v.end);
        if (isOnVacation && !dayGroups[dateKey]) {
            dayGroups[dateKey] = {
                hours: 0,
                // @ts-ignore
                isVacation: true,
                reason: 'VACACIONES'
            };
        }
        current.setDate(current.getDate() + 1);
    }

    // Table
    const tableData = Object.keys(dayGroups).sort().map(dateKey => {
        const day = dayGroups[dateKey] as any;
        if (day.isAbsence || day.isVacation) {
            const label = day.isVacation ? 'VACACIONES' : `AUSENCIA: ${day.reason}`;
            const color = day.isVacation ? [249, 115, 22] : [239, 68, 68];
            return [
                new Date(dateKey).toLocaleDateString('es-ES'),
                { content: label, colSpan: 2, styles: { halign: 'center', fontStyle: 'bold' as any, textColor: color as any } },
                '',
                '0.00h'
            ];
        }
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
        body: tableData as any,
        theme: 'striped'
    });

    await saveAndSharePDF(doc, `Resumen_${employeeName.replace(/\s+/g, '_')}_${monthStats.monthKey}.pdf`);
};
