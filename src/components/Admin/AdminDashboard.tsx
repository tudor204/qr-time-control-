import React, { useEffect, useRef } from 'react';
import { User, AttendanceRecord, Absence, Company, RecordType } from '../../types';
import { dbService } from '../../services/dbService';
import { getEmployeeStatus } from '../../utils/employeeStatus';
import { ReportsTab } from './ReportsTab';

declare const QRCode: any;

interface AdminDashboardProps {
    user: User;
    records: AttendanceRecord[];
    employees: User[];
    absences: Absence[];
    companies: Company[];
    activeTab: 'history' | 'employees' | 'settings' | 'reports' | 'companies';
    selectedCompanyId: string | null;
    qrText: string;
    showFeedback: (msg: string, type?: 'success' | 'error') => void;
    setActiveTab: (tab: any) => void;
    setSelectedCompanyId: (id: string | null) => void;
    setSelectedEmployee: (emp: User) => void;
    setCompanies: (companies: Company[]) => void;
    openNewCompanyModal: () => void;
    openEditCompanyModal: (company: Company) => void;
    loadData: (user: User) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
    user,
    records,
    employees,
    absences,
    companies,
    activeTab,
    selectedCompanyId,
    qrText,
    showFeedback,
    setActiveTab,
    setSelectedCompanyId,
    setSelectedEmployee,
    setCompanies,
    openNewCompanyModal,
    openEditCompanyModal,
    loadData
}) => {
    const qrContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeTab === 'settings' && qrContainerRef.current) {
            qrContainerRef.current.innerHTML = '';
            new QRCode(qrContainerRef.current, {
                text: qrText,
                width: 250,
                height: 250,
                colorDark: "#2563eb",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    }, [activeTab, qrText]);

    return (
        <div className="space-y-8">
            {/* Tab Bar */}
            <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 flex gap-1 overflow-x-auto custom-scrollbar no-scrollbar no-print">
                {(['companies', 'employees', 'history', 'reports', 'settings'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`flex-1 min-w-[100px] py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 interactive-button ${activeTab === tab
                            ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        <span className="flex items-center justify-center gap-2">
                            <i className={`fas ${tab === 'history' ? 'fa-list' :
                                tab === 'employees' ? 'fa-users' :
                                    tab === 'companies' ? 'fa-building' :
                                        tab === 'reports' ? 'fa-chart-bar' : 'fa-cog'
                                } text-[10px] ${activeTab === tab ? 'text-blue-400' : 'text-slate-300'}`}></i>
                            {tab === 'companies' ? 'Empresas' : tab === 'employees' ? 'Empleados' : tab === 'history' ? 'Historial' : tab === 'reports' ? 'Reportes' : 'Ajustes'}
                        </span>
                    </button>
                ))}
            </div>

            {/* Tab: Empresas */}
            {activeTab === 'companies' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Gestión de Empresas</h3>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Control multiempresa activo</p>
                        </div>
                        <button
                            onClick={openNewCompanyModal}
                            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2 interactive-button"
                        >
                            <i className="fas fa-plus"></i>
                            Nueva Empresa
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {companies.map((company, index) => (
                            <div key={company.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm transition-all group premium-card animate-list-item" style={{ animationDelay: `${index * 0.05}s` }}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 text-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                                            <i className="fas fa-building"></i>
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-800 uppercase tracking-tight">{company.name}</h4>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{company.taxId}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openEditCompanyModal(company)}
                                            className="w-10 h-10 bg-slate-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center"
                                        >
                                            <i className="fas fa-pen text-xs"></i>
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (window.confirm(`¿Migrar empleados SIN EMPRESA asignada a ${company.name}?`)) {
                                                    try {
                                                        await dbService.migrateEmployeesToCompany(company.id);
                                                        await loadData(user);
                                                        showFeedback(`Empleados sin empresa asignados a ${company.name}`);
                                                    } catch (e: any) {
                                                        showFeedback('Error en la migración', 'error');
                                                    }
                                                }
                                            }}
                                            className="w-10 h-10 bg-slate-50 text-orange-500 rounded-xl hover:bg-orange-500 hover:text-white transition-all flex items-center justify-center interactive-button"
                                            title="Migrar empleados sin empresa aquí"
                                        >
                                            <i className="fas fa-file-import text-xs"></i>
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (window.confirm("¿Eliminar empresa? Solo podrá eliminarse si no tiene trabajadores asociados.")) {
                                                    try {
                                                        await dbService.deleteCompany(company.id);
                                                        setCompanies(companies.filter(c => c.id !== company.id));
                                                        showFeedback('Empresa eliminada');
                                                    } catch (e: any) {
                                                        showFeedback(e.message, 'error');
                                                    }
                                                }
                                            }}
                                            className="w-10 h-10 bg-slate-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
                                        >
                                            <i className="fas fa-trash-alt text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between border-t border-slate-50 pt-4 mt-4">
                                    <div className="flex items-center gap-2">
                                        <i className="fas fa-users text-[10px] text-slate-300"></i>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            {employees.filter(e => e.companyId === company.id).length} Trabajadores
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedCompanyId(company.id);
                                            setActiveTab('employees');
                                        }}
                                        className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                                    >
                                        Ver plantilla →
                                    </button>
                                </div>
                            </div>
                        ))}
                        {companies.length === 0 && (
                            <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                                <i className="fas fa-building text-4xl text-slate-100 mb-4"></i>
                                <p className="text-slate-400 font-black text-xs uppercase tracking-widest">No hay empresas registradas</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tab: Historial */}
            {activeTab === 'history' && (
                <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {records.slice(0, 15).map((rec, i) => (
                        <div key={i} className="group bg-white p-5 rounded-3xl flex items-center justify-between border border-slate-100 shadow-sm transition-all outline-none focus:ring-2 focus:ring-blue-600/10 premium-card animate-list-item" style={{ animationDelay: `${i * 0.05}s` }}>
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs ${rec.type === RecordType.IN ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                                    <i className={`fas ${rec.type === RecordType.IN ? 'fa-arrow-right-to-bracket' : 'fa-arrow-right-from-bracket'}`}></i>
                                </div>
                                <div>
                                    <p className="font-black text-sm text-slate-800 tracking-tight">{rec.userName}</p>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                                        <i className="far fa-clock text-[8px]"></i>
                                        {new Date(rec.timestamp).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                            <span className={`text-[10px] font-black px-4 py-1.5 rounded-full tracking-widest ${rec.type === RecordType.IN ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                                {rec.type}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Tab: Empleados */}
            {activeTab === 'employees' && (
                <div className="space-y-6 animate-in zoom-in-95 duration-500">
                    {selectedCompanyId && (
                        <div className="flex justify-between items-center bg-blue-50 p-4 rounded-2xl border border-blue-100">
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                <i className="fas fa-filter"></i>
                                Filtrando por: {companies.find(c => c.id === selectedCompanyId)?.name}
                            </p>
                            <button
                                onClick={() => setSelectedCompanyId(null)}
                                className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors"
                            >
                                Limpiar Filtro
                            </button>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {employees
                            .filter(emp => !selectedCompanyId || emp.companyId === selectedCompanyId)
                            .map((emp, index) => {
                                const status = getEmployeeStatus(emp, records, absences);
                                return (
                                    <div
                                        key={emp.id}
                                        onClick={() => setSelectedEmployee(emp)}
                                        className={`group p-6 rounded-[2.5rem] border-2 cursor-pointer relative transition-all duration-500 ${status.label === 'Trabajando' ? 'bg-white border-green-500/10 hover:shadow-green-500/5' :
                                            status.label === 'Inactivo' ? 'bg-white border-slate-100' : 'bg-white border-orange-500/10 hover:shadow-orange-500/5'
                                            } shadow-sm premium-card animate-list-item`}
                                        style={{ animationDelay: `${index * 0.05}s` }}
                                    >
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex-1">
                                                <h4 className="font-black text-slate-800 text-base tracking-tight truncate group-hover:text-blue-600 transition-colors uppercase">{emp.name}</h4>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{emp.email}</p>
                                            </div>
                                            <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                                                {status.icon}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between mt-auto">
                                            <div className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl flex items-center gap-2 ${status.label === 'Trabajando' ? 'bg-green-500/10 text-green-600' :
                                                status.label === 'Inactivo' ? 'bg-slate-100 text-slate-400' :
                                                    status.label === 'Ausente' ? 'bg-red-500/10 text-red-600' : 'bg-orange-500/10 text-orange-600'
                                                }`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${status.label === 'Trabajando' ? 'bg-green-500 animate-pulse' :
                                                    status.label === 'Inactivo' ? 'bg-slate-300' :
                                                        status.label === 'Ausente' ? 'bg-red-500' : 'bg-orange-400'}`}></div>
                                                {status.label}
                                            </div>
                                            {status.reason && (
                                                <div className="absolute top-2 right-12">
                                                    <span className="text-[8px] font-black bg-slate-900/5 text-slate-500 px-2 py-1 rounded-lg uppercase tracking-tighter">
                                                        {status.reason}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1.5 text-slate-400">
                                                <i className="fas fa-business-time text-[10px]"></i>
                                                <p className="text-[10px] font-black tracking-tighter">{emp.weeklyHours || 40}H</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Tab: Reportes */}
            {activeTab === 'reports' && (
                <ReportsTab records={records} employees={employees} absences={absences} />
            )}

            {/* Tab: Ajustes (QR) */}
            {activeTab === 'settings' && (
                <div className="bg-white p-10 md:p-16 rounded-[3.5rem] text-center border border-slate-100 max-w-lg mx-auto shadow-2xl shadow-slate-200/50 animate-in zoom-in-95 duration-500">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[1.5rem] flex items-center justify-center text-2xl mx-auto mb-8">
                        <i className="fas fa-qrcode"></i>
                    </div>
                    <h3 className="font-black text-slate-900 mb-2 uppercase tracking-tight text-xl">Punto de Acceso Oficial</h3>
                    <p className="text-slate-400 text-xs font-medium mb-10 max-w-xs mx-auto">Coloca este código en un lugar visible para que los empleados puedan fichar.</p>

                    <div className="flex justify-center p-8 bg-slate-50 rounded-[2.5rem] mb-10 shadow-inner group relative">
                        <div ref={qrContainerRef} className="rounded-2xl overflow-hidden bg-white p-4 shadow-xl shadow-blue-600/5 transition-transform group-hover:scale-105 duration-500"></div>
                    </div>

                    <button
                        onClick={() => window.print()}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                    >
                        <i className="fas fa-print"></i>
                        Imprimir Código QR
                    </button>
                </div>
            )}
        </div>
    );
};
