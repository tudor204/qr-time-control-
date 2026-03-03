import React from 'react';
import { User, AttendanceRecord, Absence } from '../../types';
import { ProductivityWidget } from '../Dashboard/ProductivityWidget';
import { WorkHistory } from '../Employee/WorkHistory';
import { calculateDurationHours, formatDuration, getGroupedRecords, getVacationSummary } from '../../utils/timeCalculations';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface EmployeeDashboardProps {
    user: User;
    records: AttendanceRecord[];
    absences: Absence[];
    employeeTab: 'today' | 'history';
    getDayStatusText: string;
    setEmployeeTab: (tab: 'today' | 'history') => void;
    setShowScanner: (show: boolean) => void;
    setShowAbsenceModal: (show: boolean) => void;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({
    user,
    records,
    absences,
    employeeTab,
    getDayStatusText,
    setEmployeeTab,
    setShowScanner,
    setShowAbsenceModal
}) => {
    const handleExportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text('Mi Historial Laboral', 14, 22);
        doc.setFontSize(10);
        doc.text(`Empleado: ${user.name}`, 14, 32);
        doc.text(`Email: ${user.email}`, 14, 38);
        const vacSummary = getVacationSummary(user);
        doc.text(`Vacaciones: ${vacSummary.consumed} disfrutados / ${vacSummary.total} totales`, 14, 48);
        const empRecords = records
            .filter(r => r.userId === user.id)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        autoTable(doc, {
            startY: 55,
            head: [['Fecha', 'Hora', 'Tipo', 'Ubicación']],
            body: empRecords.map(r => [
                new Date(r.timestamp).toLocaleDateString(),
                new Date(r.timestamp).toLocaleTimeString(),
                r.type,
                r.location || '-'
            ]),
        });
        doc.save(`Historial_${user.name.replace(/\s+/g, '_')}.pdf`);
    };

    const isDisabled =
        absences.some(a => a.userId === user.id && a.date === new Date().toISOString().split('T')[0]) ||
        records.filter(r => r.userId === user.id && r.timestamp.startsWith(new Date().toISOString().split('T')[0])).length >= 2;

    return (
        <>
            <div className="max-w-6xl mx-auto h-auto lg:h-[calc(100vh-140px)] flex flex-col gap-6 pb-32 lg:pb-0">
                {/* Tab Selector */}
                <div className="flex justify-between items-center no-print px-1">
                    <div className="flex gap-2 sm:gap-4 w-full sm:w-auto">
                        <button
                            onClick={() => setEmployeeTab('today')}
                            className={`flex-1 sm:flex-none px-6 py-4 sm:py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${employeeTab === 'today' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
                        >
                            Hoy
                        </button>
                        <button
                            onClick={() => setEmployeeTab('history')}
                            className={`flex-1 sm:flex-none px-6 py-4 sm:py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${employeeTab === 'history' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
                        >
                            Mi Historial
                        </button>
                    </div>
                </div>

                {employeeTab === 'today' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0">
                        <div className="lg:col-span-1 space-y-6 flex flex-col min-h-0">
                            <div className="shrink-0">
                                <ProductivityWidget employee={user} title="Mi Actividad" records={records} absences={absences} />
                            </div>

                            <div className="flex gap-4 no-print shrink-0">
                                <button
                                    onClick={() => setShowAbsenceModal(true)}
                                    className="flex-1 bg-white hover:bg-red-50 text-red-500 py-5 sm:py-4 rounded-3xl font-black border-2 border-red-100 shadow-sm transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 active:scale-95 interactive-button"
                                >
                                    <i className="fas fa-calendar-times text-base"></i>
                                    Marcar Ausencia
                                </button>
                            </div>

                            {/* Panel de Vacaciones */}
                            <div className="flex-1 min-h-0 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Vacaciones</h3>
                                    <i className="fas fa-umbrella-beach text-slate-200"></i>
                                </div>
                                <div className="overflow-y-auto custom-scrollbar flex-1 space-y-2 pr-2">
                                    {user.vacations?.map((v, i) => (
                                        <div key={i} className="group bg-slate-50 p-3 rounded-2xl flex items-center gap-3 border border-transparent hover:border-orange-200 transition-all">
                                            <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center text-xs shrink-0"><i className="fas fa-calendar-check"></i></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[9px] font-black text-slate-800 uppercase tracking-wider truncate">Período</p>
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter block truncate">Del {v.start} al {v.end}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {(!user.vacations || user.vacations.length === 0) && (
                                        <div className="flex flex-col items-center justify-center py-6 opacity-40">
                                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">Sin períodos</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Panel de Actividad Reciente */}
                        <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col h-full min-h-0">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Actividad Reciente</h3>
                                    <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest mt-1">Tus fichajes</p>
                                </div>
                                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                                    <i className="fas fa-list-ul"></i>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto lg:overflow-y-auto custom-scrollbar pr-0 sm:pr-4 space-y-4">
                                {(() => {
                                    const grouped = getGroupedRecords(user.id, records);
                                    return grouped.slice(0, 10).map((day: any, i) => (
                                        <div key={i} className="group p-5 sm:p-6 rounded-[2.5rem] bg-slate-50 border border-transparent hover:border-blue-100 transition-all shadow-sm premium-card animate-list-item" style={{ animationDelay: `${i * 0.05}s` }}>
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
                                                    <span className="text-sm sm:text-base font-black text-slate-800 uppercase tracking-tight">{new Date(day.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                                                </div>
                                                <span className="text-[10px] sm:text-[11px] font-black bg-slate-900 text-white px-4 sm:px-5 py-2 rounded-full shadow-lg shadow-slate-900/5 uppercase tracking-wider">{formatDuration(calculateDurationHours(day.in, day.out))}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 sm:gap-6">
                                                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-white shadow-sm hover:shadow-md transition-shadow">
                                                    <p className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase mb-1 tracking-widest flex items-center gap-2">
                                                        <i className="fas fa-sign-in-alt text-green-500"></i>
                                                        In
                                                    </p>
                                                    <p className="font-black text-slate-700 text-lg sm:text-xl tracking-tight">{day.in ? new Date(day.in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                                                </div>
                                                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-white shadow-sm hover:shadow-md transition-shadow">
                                                    <p className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase mb-1 tracking-widest flex items-center gap-2">
                                                        <i className="fas fa-sign-out-alt text-red-500"></i>
                                                        Out
                                                    </p>
                                                    <p className="font-black text-slate-700 text-lg sm:text-xl tracking-tight">{day.out ? new Date(day.out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                        <WorkHistory
                            user={user}
                            records={records}
                            absences={absences}
                            onExportPDF={handleExportPDF}
                        />
                    </div>
                )}
            </div>

            {/* Floating Scan Button */}
            <div className="fixed bottom-6 lg:bottom-8 left-0 right-0 z-50 flex justify-center px-4 sm:px-6 no-print">
                <button
                    disabled={isDisabled}
                    onClick={() => setShowScanner(true)}
                    className="w-full max-w-sm bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-[2.5rem] font-black shadow-[0_20px_40px_rgba(37,99,235,0.3)] flex items-center justify-center gap-4 active:scale-95 transition-all uppercase tracking-[0.2em] text-sm disabled:bg-slate-300 disabled:opacity-50 disabled:scale-100 disabled:shadow-none interactive-button"
                >
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                        <i className="fas fa-qrcode text-lg"></i>
                    </div>
                    <span className="truncate">{getDayStatusText}</span>
                </button>
            </div>
        </>
    );
};
