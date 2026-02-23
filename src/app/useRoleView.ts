import { useState, useMemo } from 'react';
import { User, AttendanceRecord, Absence } from '../types';

export const useRoleView = (
    user: User | null,
    records: AttendanceRecord[],
    absences: Absence[]
) => {
    const [activeTab, setActiveTab] = useState<'history' | 'employees' | 'settings' | 'reports' | 'companies'>('history');
    const [employeeTab, setEmployeeTab] = useState<'today' | 'history'>('today');
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
    const [qrText] = useState('ACCES_POINT_001');

    const getDayStatusText = useMemo(() => {
        if (!user) return '';
        const today = new Date().toISOString().split('T')[0];
        const absence = absences.find(a => a.userId === user.id && a.date === today);
        if (absence) return 'Día de Ausencia';

        const userToday = records.filter(r => r.userId === user.id && r.timestamp.startsWith(today));
        if (userToday.length === 0) return 'Fichar Entrada';
        if (userToday.length === 1) return 'Fichar Salida';
        return 'Jornada Finalizada';
    }, [user, records, absences]);

    return {
        activeTab,
        setActiveTab,
        employeeTab,
        setEmployeeTab,
        selectedCompanyId,
        setSelectedCompanyId,
        qrText,
        getDayStatusText
    };
};
