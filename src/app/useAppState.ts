import { useState, useCallback } from 'react';
import { AttendanceRecord, User, Absence, Company, UserRole } from '../types';
import { dbService } from '../services/dbService';

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
