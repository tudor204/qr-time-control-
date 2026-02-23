import { useState } from 'react';
import { User, Company } from '../types';

export const useModals = () => {
    // Scanner
    const [showScanner, setShowScanner] = useState(false);

    // Perfil Empleado / Vacaciones
    const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
    const [vacationDate, setVacationDate] = useState({ start: '', end: '' });
    const [editingVacationId, setEditingVacationId] = useState<string | null>(null);

    // Empresa
    const [showCompanyModal, setShowCompanyModal] = useState(false);
    const [isEditingCompany, setIsEditingCompany] = useState(false);
    const [companyFormData, setCompanyFormData] = useState<Omit<Company, 'createdAt'>>({
        id: '',
        name: '',
        taxId: ''
    });

    // Ausencia
    const [showAbsenceModal, setShowAbsenceModal] = useState(false);
    const [absenceFormData, setAbsenceFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        predefinedReason: 'Baja médica',
        customReason: ''
    });

    const closeEmployeeModal = () => {
        setSelectedEmployee(null);
        setEditingVacationId(null);
        setVacationDate({ start: '', end: '' });
    };

    const openNewCompanyModal = () => {
        setIsEditingCompany(false);
        setCompanyFormData({ id: '', name: '', taxId: '' });
        setShowCompanyModal(true);
    };

    const openEditCompanyModal = (company: Company) => {
        setIsEditingCompany(true);
        setCompanyFormData({ id: company.id, name: company.name, taxId: company.taxId });
        setShowCompanyModal(true);
    };

    return {
        showScanner,
        setShowScanner,
        selectedEmployee,
        setSelectedEmployee,
        vacationDate,
        setVacationDate,
        editingVacationId,
        setEditingVacationId,
        closeEmployeeModal,
        showCompanyModal,
        setShowCompanyModal,
        isEditingCompany,
        setIsEditingCompany,
        companyFormData,
        setCompanyFormData,
        openNewCompanyModal,
        openEditCompanyModal,
        showAbsenceModal,
        setShowAbsenceModal,
        absenceFormData,
        setAbsenceFormData
    };
};
