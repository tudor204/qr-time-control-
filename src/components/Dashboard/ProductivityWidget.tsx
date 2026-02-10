import React from 'react';
import { User } from '../../types';
import { getWeeklyStats } from '../../utils/timeCalculations';
import { isCurrentlyOnVacation } from '../../utils/employeeStatus';

interface ProductivityWidgetProps {
    employee: User;
    title: string;
    records: any[];
}

export const ProductivityWidget: React.FC<ProductivityWidgetProps> = ({ employee, title, records }) => {
    const stats = getWeeklyStats(employee, records, isCurrentlyOnVacation(employee));

    return (
        <div className={`p-6 rounded-[2.5rem] shadow-sm border mb-6 relative overflow-hidden transition-all ${stats.onVacation ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</h3>
                {stats.onVacation && <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-[9px] font-black">VACACIONES 🏖️</span>}
            </div>
            <div className="flex items-end gap-2 mb-3">
                <span className={`text-4xl font-black ${stats.onVacation ? 'text-orange-600' : 'text-gray-800'}`}>{stats.total}</span>
                <span className="text-gray-400 font-bold text-xs mb-1.5 uppercase">Horas / {stats.target}h</span>
            </div>
            <div className="w-full bg-gray-200/50 h-2.5 rounded-full overflow-hidden">
                <div className={`${stats.onVacation ? 'bg-orange-500' : 'bg-blue-600'} h-full transition-all duration-1000`} style={{ width: `${stats.percent}%` }}></div>
            </div>
        </div>
    );
};
