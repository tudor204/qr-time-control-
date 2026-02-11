import React, { useState } from 'react';
import { AttendanceRecord, User, Absence } from '../../types';
import { filterRecordsByDateRange, calculateMonthlyStats, generateDetailedPDF, generateMonthlyPDF } from '../../utils/reportUtils';
import { calculateDurationHours } from '../../utils/timeCalculations';

interface ReportsTabProps {
    records: AttendanceRecord[];
    employees: User[];
    absences: Absence[];
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ records, employees, absences }) => {
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [viewMode, setViewMode] = useState<'detail' | 'monthly'>('detail');

    // Filtrar registros
    const filteredRecords = records.filter(rec => {
        if (selectedEmployeeId !== 'all' && rec.userId !== selectedEmployeeId) return false;
        return true;
    });

    const filteredAbsences = absences.filter(abs => {
        if (selectedEmployeeId !== 'all' && abs.userId !== selectedEmployeeId) return false;
        return true;
    });

    const dateFilteredRecords = filterRecordsByDateRange(filteredRecords, startDate, endDate);

    // Filtrar ausencias por fecha manualmente o actualizar reportUtils
    const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
    const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;

    const dateFilteredAbsences = filteredAbsences.filter(abs => {
        if (!start || !end) return true;
        const d = new Date(abs.date).getTime();
        return d >= start && d <= end;
    });

    // Fusionar para vista detallada
    const combinedData = [
        ...dateFilteredRecords.map(r => ({ ...r, isAbsence: false })),
        ...dateFilteredAbsences.map(a => ({
            userId: a.userId,
            userName: employees.find(e => e.id === a.userId)?.name || 'Desconocido',
            timestamp: a.date + 'T00:00:00Z',
            type: 'AUSENCIA',
            isAbsence: true,
            reason: a.predefinedReason === 'Otro' ? a.customReason : a.predefinedReason
        }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calcular estadísticas mensuales
    const monthlyStats = selectedEmployeeId !== 'all'
        ? calculateMonthlyStats(dateFilteredRecords)
        : [];

    const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Filtros */}
            {/* ... (sin cambios) */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm shadow-slate-200/50">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xs">
                        <i className="fas fa-filter"></i>
                    </div>
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Panel de Filtros</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Selector de empleado */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase block ml-2 tracking-wider">Empleado</label>
                        <div className="relative group">
                            <i className="fas fa-user text-[10px] absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors"></i>
                            <select
                                value={selectedEmployeeId}
                                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                className="w-full pl-10 p-3.5 bg-slate-50 border-2 border-transparent rounded-2xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-600/20 transition-all appearance-none cursor-pointer"
                            >
                                <option value="all">Todos los empleados</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </select>
                            <i className="fas fa-chevron-down text-[10px] absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none"></i>
                        </div>
                    </div>

                    {/* Fecha inicio */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase block ml-2 tracking-wider">Desde</label>
                        <div className="relative group">
                            <i className="fas fa-calendar-alt text-[10px] absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors"></i>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full pl-10 p-3.5 bg-slate-50 border-2 border-transparent rounded-2xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-600/20 transition-all"
                            />
                        </div>
                    </div>

                    {/* Fecha fin */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase block ml-2 tracking-wider">Hasta</label>
                        <div className="relative group">
                            <i className="fas fa-calendar-check text-[10px] absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors"></i>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full pl-10 p-3.5 bg-slate-50 border-2 border-transparent rounded-2xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-600/20 transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Toggle de vista - Segmented Control Style */}
                <div className="bg-slate-50 p-1.5 rounded-[1.5rem] flex gap-1">
                    <button
                        onClick={() => setViewMode('detail')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.15em] transition-all duration-300 ${viewMode === 'detail' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <i className={`fas fa-list-ul ${viewMode === 'detail' ? 'text-blue-500' : 'text-slate-300'}`}></i>
                        Vista Detallada
                    </button>
                    <button
                        onClick={() => setViewMode('monthly')}
                        disabled={selectedEmployeeId === 'all'}
                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.15em] transition-all duration-300 ${viewMode === 'monthly' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                        <i className={`fas fa-calendar-days ${viewMode === 'monthly' ? 'text-blue-500' : 'text-slate-300'}`}></i>
                        Resumen Mensual
                    </button>
                </div>
            </div>

            {/* Vista Detallada */}
            {viewMode === 'detail' && (
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm animate-in fade-in duration-500">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Listado de Registros</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total de {combinedData.length} movimientos</p>
                        </div>
                        {combinedData.length > 0 && selectedEmployeeId !== 'all' && (
                            <button
                                onClick={() => generateDetailedPDF(
                                    dateFilteredRecords,
                                    selectedEmployee?.name || 'Empleado',
                                    startDate || dateFilteredRecords[dateFilteredRecords.length - 1]?.timestamp.split('T')[0],
                                    endDate || dateFilteredRecords[0]?.timestamp.split('T')[0],
                                    dateFilteredAbsences
                                )}
                                className="group relative overflow-hidden bg-slate-900 text-white px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/10 active:scale-95 transition-all"
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    <i className="fas fa-file-pdf text-xs text-red-400"></i>
                                    Descargar Reporte
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            </button>
                        )}
                    </div>

                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {combinedData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                                <i className="fas fa-folder-open text-5xl mb-4 opacity-20"></i>
                                <p className="text-xs font-black uppercase tracking-[0.2em]">Sin datos disponibles</p>
                            </div>
                        ) : (
                            combinedData.map((item: any, i) => (
                                <div key={i} className={`group p-5 rounded-3xl flex items-center justify-between border-2 transition-all hover:shadow-xl hover:shadow-slate-200/40 ${item.isAbsence ? 'bg-red-50/50 border-red-100 hover:bg-white' : 'bg-slate-50/50 hover:bg-white border-transparent hover:border-blue-600/10'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${item.isAbsence ? 'bg-red-100 text-red-500' : item.type === 'IN' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                                            <i className={`fas ${item.isAbsence ? 'fa-calendar-times' : item.type === 'IN' ? 'fa-sign-in-alt' : 'fa-sign-out-alt'}`}></i>
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 text-sm leading-tight mb-1">{item.userName}</p>
                                            <div className="flex items-center gap-2">
                                                <i className={`far ${item.isAbsence ? 'fa-calendar' : 'fa-clock'} text-[10px] text-slate-300`}></i>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                                    {item.isAbsence
                                                        ? new Date(item.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
                                                        : new Date(item.timestamp).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className={`text-[10px] font-black px-4 py-1.5 rounded-full tracking-widest ${item.isAbsence ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' :
                                            item.type === 'IN' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                                            }`}>
                                            {item.isAbsence ? `AUSENCIA: ${item.reason}` : item.type === 'IN' ? 'ENTRADA' : 'SALIDA'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Vista Mensual */}
            {viewMode === 'monthly' && selectedEmployeeId !== 'all' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in zoom-in-95 duration-500">
                    {monthlyStats.length === 0 ? (
                        <div className="col-span-full py-20 bg-white rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center text-slate-300">
                            <i className="fas fa-calendar-xmark text-5xl mb-4 opacity-20"></i>
                            <p className="text-xs font-black uppercase tracking-[0.2em]">No hay historial para este empleado</p>
                        </div>
                    ) : (
                        monthlyStats.map((month, i) => (
                            <div key={i} className="group bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-blue-600/10 transition-all duration-500 hover:-translate-y-2 relative overflow-hidden">
                                {/* Badge de Fondo Decorativo */}
                                <div className="absolute top-0 right-0 p-8 text-blue-600/5 group-hover:scale-150 group-hover:text-blue-600/10 transition-all duration-700">
                                    <i className="fas fa-chart-pie text-7xl"></i>
                                </div>

                                <div className="flex justify-between items-start mb-8 relative z-10">
                                    <div>
                                        <h4 className="text-2xl font-black text-slate-800 capitalize tracking-tighter">{month.monthName}</h4>
                                        <p className="text-[11px] text-blue-600 font-black uppercase tracking-[0.2em]">{month.year}</p>
                                    </div>
                                    <button
                                        onClick={() => generateMonthlyPDF(month, selectedEmployee?.name || 'Empleado')}
                                        className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-blue-600 shadow-lg shadow-slate-900/10 hover:shadow-blue-600/20 transition-all duration-300"
                                        title="Exportar PDF Mensual"
                                    >
                                        <i className="fas fa-file-export text-sm"></i>
                                    </button>
                                </div>

                                <div className="space-y-4 relative z-10">
                                    <div className="bg-slate-50 p-5 rounded-3xl group-hover:bg-blue-50/50 transition-colors">
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1 group-hover:text-blue-400">Tiempo Total</p>
                                        <div className="flex items-baseline gap-2">
                                            <p className="text-3xl font-black text-slate-900 tracking-tighter group-hover:text-blue-700 transition-colors">{month.totalHours}</p>
                                            <p className="text-xs font-bold text-slate-400">horas</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 p-4 rounded-3xl border border-transparent group-hover:border-blue-100 transition-all">
                                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Días</p>
                                            <p className="text-xl font-black text-slate-800">{month.daysWorked}</p>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-3xl border border-transparent group-hover:border-blue-100 transition-all">
                                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Media</p>
                                            <p className="text-xl font-black text-slate-800">{month.avgHoursPerDay}h</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
