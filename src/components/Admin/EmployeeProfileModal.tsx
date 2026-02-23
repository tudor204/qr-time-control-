import React from 'react';
import { User, Company } from '../../types';
import { dbService } from '../../services/dbService';
import { ProductivityWidget } from '../Dashboard/ProductivityWidget';
import { AttendanceRecord, Absence } from '../../types';
import { getWeeklyStats } from '../../utils/timeCalculations';
import { isCurrentlyOnVacation } from '../../utils/employeeStatus';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface EmployeeProfileModalProps {
    employee: User;
    records: AttendanceRecord[];
    absences: Absence[];
    employees: User[];
    companies: Company[];
    vacationDate: { start: string; end: string };
    editingVacationId: string | null;
    showFeedback: (msg: string, type?: 'success' | 'error', duration?: number) => void;
    setEmployees: (employees: User[]) => void;
    setSelectedEmployee: (emp: User | null) => void;
    setVacationDate: (date: { start: string; end: string }) => void;
    setEditingVacationId: (id: string | null) => void;
    onClose: () => void;
}

export const EmployeeProfileModal: React.FC<EmployeeProfileModalProps> = ({
    employee,
    records,
    absences,
    employees,
    companies,
    vacationDate,
    editingVacationId,
    showFeedback,
    setEmployees,
    setSelectedEmployee,
    setVacationDate,
    setEditingVacationId,
    onClose
}) => {
    const handleGeneratePDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text('Reporte de Empleado', 14, 22);
        doc.setFontSize(10);
        doc.text(`Nombre: ${employee.name}`, 14, 32);
        doc.text(`Email: ${employee.email}`, 14, 38);
        const stats = getWeeklyStats(employee, records, isCurrentlyOnVacation(employee), absences);
        doc.text(`Horas esta semana: ${stats.total}`, 14, 44);
        const empRecords = records
            .filter(r => r.userId === employee.id)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        autoTable(doc, {
            startY: 55,
            head: [['Fecha', 'Hora', 'Tipo']],
            body: empRecords.map(r => [
                new Date(r.timestamp).toLocaleDateString(),
                new Date(r.timestamp).toLocaleTimeString(),
                r.type
            ]),
        });
        doc.save(`Reporte_${employee.name}.pdf`);
    };

    const updateEmployee = async (updatedUser: User) => {
        try {
            await dbService.saveUserProfile(updatedUser);
            setEmployees(employees.map(emp => emp.id === updatedUser.id ? updatedUser : emp));
            setSelectedEmployee(updatedUser);
        } catch (e) {
            showFeedback('Error al actualizar', 'error', 2000);
            throw e;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6 no-print">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose}></div>
            <div className="bg-slate-50 w-full max-w-2xl rounded-t-[3rem] md:rounded-[3.5rem] shadow-[0_30px_90px_rgba(0,0,0,0.3)] relative z-10 overflow-hidden flex flex-col max-h-[92vh] animate-modal-in">
                {/* Header */}
                <div className="p-8 md:p-10 bg-white border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-xl shadow-blue-600/20">
                            <i className="fas fa-user-tie"></i>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">{employee.name}</h3>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mt-1">Perfil del Trabajador</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleGeneratePDF}
                            className="bg-slate-900 text-white w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-slate-800 transition-all"
                        >
                            <i className="fas fa-file-pdf"></i>
                        </button>
                        <button
                            onClick={onClose}
                            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-red-500 transition-all"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-8 md:p-10 overflow-y-auto bg-slate-50 space-y-8 custom-scrollbar">
                    <ProductivityWidget employee={employee} title="Productividad" records={records} absences={absences} />

                    {/* Selector de Empresa */}
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-blue-100 transition-colors duration-500"></div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 relative z-10">
                            <i className="fas fa-building mr-2 text-blue-400"></i>
                            Empresa Asignada
                        </h4>
                        <div className="relative z-10">
                            <select
                                value={employee.companyId || ''}
                                onChange={async (e) => {
                                    const newCompanyId = e.target.value;
                                    const updatedUser = { ...employee, companyId: newCompanyId };
                                    try {
                                        await updateEmployee(updatedUser);
                                        showFeedback('Empresa actualizada', 'success', 2000);
                                    } catch (e) { /* handled in updateEmployee */ }
                                }}
                                className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-[1.5rem] font-black text-slate-900 outline-none focus:bg-white focus:border-blue-600/20 transition-all appearance-none cursor-pointer"
                            >
                                <option value="">Sin Empresa (Individual)</option>
                                {companies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Editor de Horas Semanales */}
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-blue-100 transition-colors duration-500"></div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 relative z-10">
                            <i className="fas fa-hourglass-half mr-2 text-blue-400"></i>
                            Carga Horaria Semanal
                        </h4>
                        <div className="flex items-center gap-6 relative z-10">
                            <input
                                type="number"
                                value={employee.weeklyHours || 40}
                                onChange={async (e) => {
                                    const newHours = parseInt(e.target.value) || 40;
                                    const updatedUser = { ...employee, weeklyHours: newHours };
                                    try {
                                        await updateEmployee(updatedUser);
                                        showFeedback(`Horas actualizadas a ${newHours}h`, 'success', 2000);
                                    } catch (e) { /* handled */ }
                                }}
                                className="w-24 p-4 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-center text-xl font-black text-slate-900 outline-none focus:bg-white focus:border-blue-600/20 transition-all"
                            />
                            <div>
                                <p className="text-sm font-black text-slate-800 tracking-tight">Horas Estimadas</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Calculado para balance semanal</p>
                            </div>
                        </div>
                    </div>

                    {/* Editor de Vacaciones Totales */}
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50/50 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-orange-100 transition-colors duration-500"></div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 relative z-10">
                            <i className="fas fa-umbrella-beach mr-2 text-orange-400"></i>
                            Días de Vacaciones Anuales
                        </h4>
                        <div className="flex items-center gap-6 relative z-10">
                            <input
                                type="number"
                                value={employee.totalVacationDays || 30}
                                onChange={async (e) => {
                                    const newDays = parseInt(e.target.value) || 30;
                                    const updatedUser = { ...employee, totalVacationDays: newDays };
                                    try {
                                        await updateEmployee(updatedUser);
                                        showFeedback(`Vacaciones anuales: ${newDays} días`, 'success', 2000);
                                    } catch (e) { /* handled */ }
                                }}
                                className="w-24 p-4 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-center text-xl font-black text-slate-900 outline-none focus:bg-white focus:border-blue-600/20 transition-all"
                            />
                            <div>
                                <p className="text-sm font-black text-slate-800 tracking-tight">Días Totales</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Disponibles por cada año natural</p>
                            </div>
                        </div>
                    </div>

                    {/* Gestor de Períodos de Vacaciones */}
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Asignar Período de Vacaciones</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4 text-center block">Inicio</label>
                                    <input type="date" value={vacationDate.start} onChange={e => setVacationDate({ ...vacationDate, start: e.target.value })} className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-600/20 transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4 text-center block">Fin</label>
                                    <input type="date" value={vacationDate.end} onChange={e => setVacationDate({ ...vacationDate, end: e.target.value })} className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-600/20 transition-all" />
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    if (!vacationDate.start || !vacationDate.end) {
                                        showFeedback('Selecciona fechas', 'error');
                                        return;
                                    }
                                    const newVacation = { id: editingVacationId || Date.now().toString(), start: vacationDate.start, end: vacationDate.end };
                                    const updatedVacations = editingVacationId
                                        ? (employee.vacations || []).map(v => v.id === editingVacationId ? newVacation : v)
                                        : [...(employee.vacations || []), newVacation];

                                    const updatedUser = { ...employee, vacations: updatedVacations };
                                    try {
                                        await updateEmployee(updatedUser);
                                        setVacationDate({ start: '', end: '' });
                                        setEditingVacationId(null);
                                        showFeedback(editingVacationId ? 'Período actualizado' : 'Período añadido');
                                    } catch (e) { showFeedback('Error al guardar', 'error'); }
                                }}
                                className="w-full mt-6 bg-blue-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all"
                            >
                                {editingVacationId ? 'Actualizar Período' : 'Añadir Vacaciones'}
                            </button>
                        </div>

                        <div className="space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Períodos Registrados</p>
                            {(employee.vacations || []).map((v) => (
                                <div key={v.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-blue-200 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                                            <i className="fas fa-calendar-alt text-xs"></i>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Del {v.start} al {v.end}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Vacaciones Pagadas</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => {
                                                setEditingVacationId(v.id);
                                                setVacationDate({ start: v.start, end: v.end });
                                            }}
                                            className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all"
                                        >
                                            <i className="fas fa-pen text-[10px]"></i>
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (window.confirm("¿Eliminar período?")) {
                                                    const updatedVacations = employee.vacations?.filter(vac => vac.id !== v.id);
                                                    const updatedUser = { ...employee, vacations: updatedVacations };
                                                    try {
                                                        await updateEmployee(updatedUser);
                                                        showFeedback('Período eliminado');
                                                    } catch (e) {
                                                        showFeedback('Error al eliminar', 'error');
                                                    }
                                                }
                                            }}
                                            className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-600 hover:text-white transition-all"
                                        >
                                            <i className="fas fa-trash-alt text-[10px]"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
