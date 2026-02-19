import React from 'react';
import { User, Absence } from '../../types';
import { getWeeklyStats } from '../../utils/timeCalculations';
import { isCurrentlyOnVacation, getEmployeeStatus } from '../../utils/employeeStatus';

interface ProductivityWidgetProps {
    employee: User;
    title: string;
    records: any[];
    absences?: Absence[];
}

export const ProductivityWidget: React.FC<ProductivityWidgetProps> = ({ employee, title, records, absences = [] }) => {
    const currentStatus = getEmployeeStatus(employee, records, absences);
    const stats = getWeeklyStats(employee, records, isCurrentlyOnVacation(employee), absences);
    const isAbsentToday = currentStatus.label === 'Ausente';

    return (
        <div className={`p-6 md:p-8 rounded-[2.5rem] shadow-sm border mb-6 relative overflow-hidden transition-all group premium-card ${stats.onVacation ? 'bg-orange-50 border-orange-200' : isAbsentToday ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100 hover:shadow-xl hover:shadow-blue-600/5'}`}>
            {/* Fondo Decorativo Sutil */}
            <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl opacity-10 rounded-full -mr-16 -mt-16 transition-all duration-700 group-hover:scale-150 ${stats.onVacation ? 'bg-orange-500' : isAbsentToday ? 'bg-red-500' : 'bg-blue-600'}`}></div>

            <div className="flex justify-between items-center mb-6 relative z-10">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</h3>
                {stats.onVacation ? (
                    <span className="bg-orange-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black shadow-lg shadow-orange-200 animate-bounce">
                        VACACIONES 🏖️
                    </span>
                ) : isAbsentToday ? (
                    <div className="flex flex-col items-end gap-1">
                        <span className="bg-red-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black shadow-lg shadow-red-200 animate-pulse">
                            AUSENTE 🗓️
                        </span>
                        {currentStatus.reason && (
                            <span className="text-[9px] font-black text-red-400 uppercase tracking-widest bg-red-50/50 px-2 py-0.5 rounded-lg border border-red-100/50">
                                {currentStatus.reason}
                            </span>
                        )}
                    </div>
                ) : null}
            </div>

            <div className="flex items-baseline gap-2 mb-6 relative z-10 transition-transform group-hover:translate-x-1 duration-300">
                <span className={`text-5xl font-black tracking-tighter ${stats.onVacation ? 'text-orange-600' : isAbsentToday ? 'text-red-600' : 'text-slate-900'}`}>
                    {stats.total}
                </span>
                <span className="text-slate-400 font-bold text-sm uppercase tracking-wider underline decoration-slate-200 underline-offset-4 decoration-2">
                    Horas / {stats.target}h
                </span>
            </div>

            <div className="relative z-10">
                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">
                    <span>Progreso Semanal {isAbsentToday && '(Ajustado)'}</span>
                    <span className={stats.onVacation ? 'text-orange-500' : isAbsentToday ? 'text-red-500' : 'text-blue-600'}>{Math.round(stats.percent)}%</span>
                </div>
                <div className="w-full bg-slate-100 h-4 rounded-2xl p-1 overflow-hidden">
                    <div
                        className={`h-full rounded-xl transition-all duration-1000 ease-out relative ${stats.onVacation ? 'bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : isAbsentToday ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.3)]'}`}
                        style={{ width: `${stats.percent}%` }}
                    >
                        <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-full"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
