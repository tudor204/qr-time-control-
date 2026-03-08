import { useState, useCallback } from 'react';
import { AttendanceRecord, User, Absence, Company, UserRole } from '../types';
import { dbService } from '../services/dbService';
import { flagStaleShifts } from '../utils/attendanceUtils';

export const useAppState = () => {
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [employees, setEmployees] = useState<User[]>([]);
    const [absences, setAbsences] = useState<Absence[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);

    const loadData = useCallback(async (currentUser: User) => {
        try {
            const isAdmin = currentUser.role === UserRole.ADMIN;
            const [recs, emps, abs, comps] = await Promise.all([
                dbService.getRecords(isAdmin ? undefined : currentUser.id),
                isAdmin ? dbService.getEmployees() : Promise.resolve([]),
                dbService.getAbsences(isAdmin ? undefined : currentUser.id),
                isAdmin ? dbService.getCompanies() : Promise.resolve([])
            ]);
            // si hay ins abiertos que llevan >12h, marcarlos en la base
            const corrected = flagStaleShifts(recs);
            // sólo actualizamos los que hayan cambiado
            corrected.forEach(r => {
                const original = recs.find(x => x.id === r.id);
                if (original && original.status !== r.status) {
                    // no await para no bloquear, pero informamos si hay fallo
                    dbService.updateAttendanceRecord(r.userId, r.id!, { status: r.status });
                }
            });
            setRecords(recs);
            setEmployees(emps);
            setAbsences(abs);
            setCompanies(comps);
        } catch (e) {
            console.error("Error cargando datos en useAppState:", e);
        }
    }, []);

    return {
        records,
        setRecords,
        employees,
        setEmployees,
        absences,
        setAbsences,
        companies,
        setCompanies,
        loadData
    };
};
