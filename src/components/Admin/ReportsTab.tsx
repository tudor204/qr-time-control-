import React, { useState } from 'react';
import { AttendanceRecord, User } from '../../types';
import { filterRecordsByDateRange, calculateMonthlyStats, generateDetailedPDF, generateMonthlyPDF } from '../../utils/reportUtils';
import { calculateDurationHours } from '../../utils/timeCalculations';

interface ReportsTabProps {
    records: AttendanceRecord[];
    employees: User[];
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ records, employees }) => {
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [viewMode, setViewMode] = useState<'detail' | 'monthly'>('detail');

    // Filtrar registros
    const filteredRecords = records.filter(rec => {
        if (selectedEmployeeId !== 'all' && rec.userId !== selectedEmployeeId) return false;
        return true;
    });

    const dateFilteredRecords = filterRecordsByDateRange(filteredRecords, startDate, endDate);

    // Agrupar por empleado para vista detallada
    const recordsByEmployee: { [key: string]: AttendanceRecord[] } = {};
    dateFilteredRecords.forEach(rec => {
        if (!recordsByEmployee[rec.userId]) {
            recordsByEmployee[rec.userId] = [];
        }
        recordsByEmployee[rec.userId].push(rec);
    });

    // Calcular estadísticas mensuales
    const monthlyStats = selectedEmployeeId !== 'all'
        ? calculateMonthlyStats(dateFilteredRecords)
        : [];

    const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

    return (
        <div className="space-y-6">
            {/* Filtros */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Filtros</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* Selector de empleado */}
                    <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase block mb-2">Empleado</label>
                        <select
                            value={selectedEmployeeId}
                            onChange={(e) => setSelectedEmployeeId(e.target.value)}
                            className="w-full p-3 bg-gray-50 rounded-xl text-xs font-bold border-none"
                        >
                            <option value="all">Todos los empleados</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Fecha inicio */}
                    <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase block mb-2">Fecha Inicio</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full p-3 bg-gray-50 rounded-xl text-xs font-bold border-none"
                        />
                    </div>

                    {/* Fecha fin */}
                    <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase block mb-2">Fecha Fin</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full p-3 bg-gray-50 rounded-xl text-xs font-bold border-none"
                        />
                    </div>
                </div>

                {/* Toggle de vista */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode('detail')}
                        className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${viewMode === 'detail' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-400'
                            }`}
                    >
                        Vista Detallada
                    </button>
                    <button
                        onClick={() => setViewMode('monthly')}
                        disabled={selectedEmployeeId === 'all'}
                        className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${viewMode === 'monthly' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-400'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        Resumen Mensual
                    </button>
                </div>

                {selectedEmployeeId === 'all' && viewMode === 'monthly' && (
                    <p className="text-[9px] text-orange-500 font-bold mt-2 text-center">
                        Selecciona un empleado específico para ver el resumen mensual
                    </p>
                )}
            </div>

            {/* Vista Detallada */}
            {viewMode === 'detail' && (
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Registros ({dateFilteredRecords.length})
                        </h3>
                        {dateFilteredRecords.length > 0 && selectedEmployeeId !== 'all' && (
                            <button
                                onClick={() => generateDetailedPDF(
                                    dateFilteredRecords,
                                    selectedEmployee?.name || 'Empleado',
                                    startDate || dateFilteredRecords[dateFilteredRecords.length - 1]?.timestamp.split('T')[0],
                                    endDate || dateFilteredRecords[0]?.timestamp.split('T')[0]
                                )}
                                className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase shadow-md hover:bg-blue-700 transition-all"
                            >
                                <i className="fas fa-file-pdf mr-2"></i>
                                Exportar PDF
                            </button>
                        )}
                    </div>

                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {dateFilteredRecords.length === 0 ? (
                            <p className="text-center text-gray-400 text-xs font-bold py-8">
                                No hay registros para los filtros seleccionados
                            </p>
                        ) : (
                            dateFilteredRecords.map((rec, i) => (
                                <div key={i} className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-sm text-gray-800">{rec.userName}</p>
                                        <p className="text-[9px] text-gray-400 font-black uppercase">
                                            {new Date(rec.timestamp).toLocaleString('es-ES')}
                                        </p>
                                    </div>
                                    <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${rec.type === 'IN' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                                        }`}>
                                        {rec.type}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Vista Mensual */}
            {viewMode === 'monthly' && selectedEmployeeId !== 'all' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {monthlyStats.length === 0 ? (
                        <div className="col-span-full">
                            <p className="text-center text-gray-400 text-xs font-bold py-8">
                                No hay datos para mostrar
                            </p>
                        </div>
                    ) : (
                        monthlyStats.map((month, i) => (
                            <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="text-lg font-black text-gray-800 capitalize">{month.monthName}</h4>
                                        <p className="text-[9px] text-gray-400 font-black uppercase">{month.year}</p>
                                    </div>
                                    <button
                                        onClick={() => generateMonthlyPDF(month, selectedEmployee?.name || 'Empleado')}
                                        className="bg-blue-100 text-blue-600 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all"
                                        title="Exportar PDF"
                                    >
                                        <i className="fas fa-file-pdf text-xs"></i>
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <div className="bg-gray-50 p-3 rounded-xl">
                                        <p className="text-[8px] text-gray-400 font-black uppercase">Total Horas</p>
                                        <p className="text-2xl font-black text-gray-800">{month.totalHours}h</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-gray-50 p-3 rounded-xl">
                                            <p className="text-[8px] text-gray-400 font-black uppercase">Días</p>
                                            <p className="text-lg font-black text-gray-800">{month.daysWorked}</p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-xl">
                                            <p className="text-[8px] text-gray-400 font-black uppercase">Promedio</p>
                                            <p className="text-lg font-black text-gray-800">{month.avgHoursPerDay}h</p>
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
