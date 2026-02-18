import React from 'react';
import { User, AttendanceRecord, Absence, RecordType } from '../../types';
import {
    calculateDurationHours,
    formatDuration,
    getGroupedRecords,
    getWeeklyStats,
    getMonthlyStats,
    getVacationSummary
} from '../../utils/timeCalculations';
import { isCurrentlyOnVacation } from '../../utils/employeeStatus';

interface WorkHistoryProps {
    user: User;
    records: AttendanceRecord[];
    absences: Absence[];
    onExportPDF: () => void;
}

export const WorkHistory: React.FC<WorkHistoryProps> = ({ user, records, absences, onExportPDF }) => {
    const weeklyStats = getWeeklyStats(user, records, isCurrentlyOnVacation(user), absences);
    const monthlyStats = getMonthlyStats(user.id, records);
    const vacationSummary = getVacationSummary(user);

    const groupedDays = getGroupedRecords(user.id, records);
    const userAbsences = absences.filter(a => a.userId === user.id);

    const allDays = [...groupedDays];
    userAbsences.forEach(abs => {
        if (!allDays.find((d: any) => d.date === abs.date)) {
            allDays.push({ date: abs.date, isAbsence: true, absence: abs });
        }
    });

    const sortedDays = allDays.sort((a: any, b: any) => b.date.localeCompare(a.date));

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header de Sección con Exportación */}
            <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm shrink-0">
                <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Mi Historial Laboral</h2>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Resumen de actividad y tiempo</p>
                </div>
                <button
                    onClick={onExportPDF}
                    className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 active:scale-95"
                >
                    <i className="fas fa-file-pdf"></i>
                    Exportar Informe
                </button>
            </div>

            {/* Grid de Estadísticas Compacto */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                {/* Horas Semanales */}
                <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Esta Semana</p>
                    <div className="flex items-baseline gap-2 relative z-10">
                        <span className="text-3xl font-black text-slate-900">{weeklyStats.total}</span>
                        <span className="text-slate-400 font-bold text-[10px]">/ {weeklyStats.target}h</span>
                    </div>
                </div>

                {/* Horas Mensuales */}
                <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Mes de {monthlyStats.monthName}</p>
                    <div className="flex items-baseline gap-2 relative z-10">
                        <span className="text-3xl font-black text-slate-900">{monthlyStats.total}</span>
                        <span className="text-slate-400 font-bold text-[10px]">Horas Totales</span>
                    </div>
                </div>

                {/* Vacaciones */}
                <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Vacaciones {new Date().getFullYear()}</p>
                    <div className="flex items-baseline gap-2 relative z-10">
                        <span className="text-3xl font-black text-slate-900">{vacationSummary.consumed}</span>
                        <span className="text-orange-600 font-bold text-[10px]">/{vacationSummary.total} días</span>
                    </div>
                </div>
            </div>

            {/* Listado de Días */}
            <div className="flex-1 min-h-0 flex flex-col bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-6 mb-6">Detalle de Actividad Reciente</h3>
                <div className="overflow-y-auto custom-scrollbar flex-1 space-y-4 pr-4">
                    {sortedDays.map((day: any, i) => (
                        <div key={i} className={`group p-8 rounded-[3rem] border transition-all ${day.isAbsence ? 'bg-red-50/30 border-red-100' : 'bg-slate-50 border-transparent hover:border-blue-100'}`}>
                            <div className="flex justify-between items-center mb-8">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm ${day.isAbsence ? 'bg-red-100 text-red-500' : 'bg-blue-50 text-blue-600'}`}>
                                        <i className={`fas ${day.isAbsence ? 'fa-calendar-times' : 'fa-calendar-day'}`}></i>
                                    </div>
                                    <span className="text-base font-black text-slate-800 uppercase tracking-tight">
                                        {new Date(day.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
                                    </span>
                                </div>
                                {day.isAbsence ? (
                                    <span className="text-[10px] font-black bg-red-500 text-white px-5 py-2 rounded-full shadow-lg shadow-red-900/10 uppercase tracking-wider">AUSENTE</span>
                                ) : (
                                    <span className="text-[11px] font-black bg-slate-900 text-white px-5 py-2 rounded-full shadow-lg shadow-slate-900/10 uppercase tracking-wider">
                                        {formatDuration(calculateDurationHours(day.in, day.out))}
                                    </span>
                                )}
                            </div>

                            {day.isAbsence ? (
                                <div className="bg-white/50 p-6 rounded-2xl border border-red-100">
                                    <p className="text-[10px] text-red-400 font-black uppercase tracking-widest mb-1.5 shadow-sm">Motivo:</p>
                                    <p className="font-bold text-slate-700 text-base">
                                        {day.absence.predefinedReason === 'Otro' ? day.absence.customReason : day.absence.predefinedReason}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="bg-white p-5 rounded-2xl border border-transparent transition-colors group-hover:bg-green-50/50 group-hover:border-green-100 shadow-sm">
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <i className="fas fa-arrow-right-to-bracket text-green-500"></i>
                                            Entrada
                                        </p>
                                        <p className="font-black text-slate-700 text-xl tracking-tight">
                                            {day.in ? new Date(day.in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                        </p>
                                    </div>
                                    <div className="bg-white p-5 rounded-2xl border border-transparent transition-colors group-hover:bg-red-50/50 group-hover:border-red-100 shadow-sm">
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <i className="fas fa-arrow-right-from-bracket text-red-500"></i>
                                            Salida
                                        </p>
                                        <p className="font-black text-slate-700 text-xl tracking-tight">
                                            {day.out ? new Date(day.out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {sortedDays.length === 0 && (
                        <div className="flex flex-col items-center justify-center p-20 opacity-60">
                            <i className="fas fa-history text-4xl text-slate-200 mb-4"></i>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">No hay registros históricos aún</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
