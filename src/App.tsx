import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, AttendanceRecord, RecordType, Absence, Company } from './types';
import { auth } from './services/firebaseConfig';
import { dbService } from './services/dbService';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "firebase/auth";
import Scanner from './components/Scanner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LoginForm } from './components/Auth/LoginForm';
import { ProductivityWidget } from './components/Dashboard/ProductivityWidget';
import { ReportsTab } from './components/Admin/ReportsTab';
import { WorkHistory } from './components/Employee/WorkHistory';
import { calculateDurationHours, formatDuration, getGroupedRecords, getWeeklyStats, getVacationSummary } from './utils/timeCalculations';
import { isCurrentlyOnVacation, getEmployeeStatus } from './utils/employeeStatus';

declare const QRCode: any;

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'employees' | 'settings' | 'reports' | 'companies'>('history');
  const [employeeTab, setEmployeeTab] = useState<'today' | 'history'>('today');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [vacationDate, setVacationDate] = useState({ start: '', end: '' });
  const [editingVacationId, setEditingVacationId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyFormData, setCompanyFormData] = useState<Omit<Company, 'createdAt'>>({ id: '', name: '', taxId: '' });
  const [isEditingCompany, setIsEditingCompany] = useState(false);

  // Estados para el Modal de Ausencia
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [absenceFormData, setAbsenceFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    predefinedReason: 'Baja médica',
    customReason: ''
  });

  const qrContainerRef = useRef<HTMLDivElement>(null);
  const [qrText] = useState('ACCES_POINT_001');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const idTokenResult = await firebaseUser.getIdTokenResult();
        const roleFromClaim = idTokenResult.claims.role as UserRole | undefined;

        const profile = await dbService.getUserProfile(firebaseUser.uid);
        if (profile) {
          const updatedUser = {
            ...profile,
            role: roleFromClaim || profile.role
          };
          setUser(updatedUser);
          loadData(updatedUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

  const loadData = async (currentUser: User) => {
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
    } catch (e) { console.error(e); }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      if (isRegistering) {
        const creds = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const newUser: User = { id: creds.user.uid, name: formData.name, email: formData.email, role: UserRole.EMPLOYEE, weeklyHours: 40, vacations: [] };
        await dbService.saveUserProfile(newUser);
        setUser(newUser);
        setFeedback({ type: 'success', msg: 'Cuenta creada correctamente' });
      } else {
        const creds = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        const profile = await dbService.getUserProfile(creds.user.uid);
        if (profile) {
          setUser(profile);
          setFeedback({ type: 'success', msg: `Bienvenido, ${profile.name}` });
        }
      }
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: 'Error de acceso: Credenciales no válidas' });
      setTimeout(() => setFeedback(null), 3000);
    } finally { setLoading(false); }
  };

  const handleQrScan = async (code: string) => {
    if (!user || code.trim() !== qrText.trim()) {
      setFeedback({ type: 'error', msg: 'QR no válido' });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const absence = absences.find(a => a.userId === user.id && a.date === today);
    if (absence) {
      setFeedback({ type: 'error', msg: 'Día marcado como AUSENTE. No puedes fichar hoy.' });
      return;
    }

    const userToday = records.filter(r => r.userId === user.id && r.timestamp.startsWith(today));
    if (userToday.length >= 2) {
      setFeedback({ type: 'error', msg: 'Ya has completado tu jornada de hoy' });
      setTimeout(() => setShowScanner(false), 2000);
      return;
    }

    const nextType = userToday.length === 0 ? RecordType.IN : RecordType.OUT;

    try {
      await dbService.addRecord(user.id, user.name, code, nextType);
      setFeedback({ type: 'success', msg: nextType === RecordType.IN ? '¡Entrada registrada!' : '¡Salida registrada!' });
      setTimeout(() => {
        setFeedback(null);
        setShowScanner(false);
        loadData(user);
      }, 1500);
    } catch (e) {
      setFeedback({ type: 'error', msg: 'Error al fichar' });
    }
  };

  const handleSaveAbsence = async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const userToday = records.filter(r => r.userId === user.id && r.timestamp.startsWith(today));
    if (userToday.length > 0) {
      setFeedback({ type: 'error', msg: 'No puedes marcar ausencia si ya has fichado hoy' });
      return;
    }

    try {
      await dbService.addAbsence({
        userId: user.id,
        date: absenceFormData.date,
        predefinedReason: absenceFormData.predefinedReason,
        customReason: absenceFormData.predefinedReason === 'Otro' ? absenceFormData.customReason : undefined
      });
      setFeedback({ type: 'success', msg: 'Ausencia registrada correctamente' });
      setShowAbsenceModal(false);
      loadData(user);
    } catch (e) {
      setFeedback({ type: 'error', msg: 'Error al registrar ausencia' });
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  const getDayStatusText = () => {
    if (!user) return '';
    const today = new Date().toISOString().split('T')[0];
    const absence = absences.find(a => a.userId === user.id && a.date === today);
    if (absence) return 'Día de Ausencia';

    const userToday = records.filter(r => r.userId === user.id && r.timestamp.startsWith(today));
    if (userToday.length === 0) return 'Fichar Entrada';
    if (userToday.length === 1) return 'Fichar Salida';
    return 'Jornada Finalizada';
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-blue-600 animate-pulse uppercase">Cargando sistema...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md">
          <h2 className="text-2xl font-black text-center mb-8 uppercase tracking-tighter">Panel de Acceso</h2>
          <form onSubmit={handleAuth} className="space-y-4">
            {isRegistering && <input type="text" placeholder="Nombre" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold" required />}
            <input type="email" placeholder="Email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold" required />
            <input type="password" placeholder="Contraseña" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold" required />
            <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase shadow-lg">Entrar</button>
          </form>
          <button onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-6 text-[10px] text-gray-400 font-black uppercase">{isRegistering ? 'Ya tengo cuenta' : 'Crear nueva cuenta'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-32 font-inter selection:bg-blue-100 selection:text-blue-700">
      <header className="bg-white/80 backdrop-blur-md p-6 shadow-sm flex justify-between items-center sticky top-0 z-50 border-b border-slate-100 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <i className="fas fa-clock text-white"></i>
          </div>
          <div>
            <h1 className="font-black text-lg text-slate-900 leading-none">QR Control</h1>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Smart Attendance</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-0.5">Sesión Activa</span>
            <p className="text-sm font-black text-slate-900">Bienvenido, <span className="text-blue-600">{user.name}</span></p>
          </div>
          <button onClick={() => {
            signOut(auth);
            setFeedback({ type: 'success', msg: 'Sesión cerrada correctamente' });
            setTimeout(() => setFeedback(null), 2000);
          }} className="group flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all font-bold text-xs interactive-button">
            <span className="hidden sm:block">Cerrar Sesión</span>
            <i className="fas fa-power-off transition-transform group-hover:rotate-12"></i>
          </button>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {user.role === UserRole.ADMIN ? (
          <div className="space-y-8">
            {/* Navegación - Segmented Control */}
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

            {activeTab === 'companies' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Gestión de Empresas</h3>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Control multiempresa activo</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsEditingCompany(false);
                      setCompanyFormData({ id: '', name: '', taxId: '' });
                      setShowCompanyModal(true);
                    }}
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
                            onClick={() => {
                              setIsEditingCompany(true);
                              setCompanyFormData({ id: company.id, name: company.name, taxId: company.taxId });
                              setShowCompanyModal(true);
                            }}
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
                                  setFeedback({ type: 'success', msg: `Empleados sin empresa asignados a ${company.name}` });
                                } catch (e: any) {
                                  setFeedback({ type: 'error', msg: 'Error en la migración' });
                                }
                                setTimeout(() => setFeedback(null), 3000);
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
                                  setFeedback({ type: 'success', msg: 'Empresa eliminada' });
                                } catch (e: any) {
                                  setFeedback({ type: 'error', msg: e.message });
                                }
                                setTimeout(() => setFeedback(null), 3000);
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

            {activeTab === 'reports' && (
              <ReportsTab records={records} employees={employees} absences={absences} />
            )}

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
        ) : (
          <div className="max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col gap-6">
            <div className="flex justify-between items-center no-print">
              <div className="flex gap-4">
                <button
                  onClick={() => setEmployeeTab('today')}
                  className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${employeeTab === 'today' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
                >
                  Hoy
                </button>
                <button
                  onClick={() => setEmployeeTab('history')}
                  className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${employeeTab === 'history' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
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
                      className="flex-1 bg-white hover:bg-red-50 text-red-500 py-4 rounded-3xl font-black border-2 border-red-100 shadow-sm transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 active:scale-95"
                    >
                      <i className="fas fa-calendar-times text-base"></i>
                      Marcar Ausencia
                    </button>
                  </div>

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

                <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col h-full min-h-0">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Listado de Actividad Reciente</h3>
                      <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest mt-1">Detalle de tus fichajes</p>
                    </div>
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                      <i className="fas fa-list-ul"></i>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-4">
                    {(() => {
                      const grouped = getGroupedRecords(user.id, records);
                      return grouped.slice(0, 10).map((day: any, i) => (
                        <div key={i} className="group p-6 rounded-[2.5rem] bg-slate-50 border border-transparent hover:border-blue-100 transition-all shadow-sm premium-card animate-list-item" style={{ animationDelay: `${i * 0.05}s` }}>
                          <div className="flex justify-between items-center mb-5">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
                              <span className="text-base font-black text-slate-800 uppercase tracking-tight">{new Date(day.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                            </div>
                            <span className="text-[11px] font-black bg-slate-900 text-white px-5 py-2 rounded-full shadow-lg shadow-slate-900/5 uppercase tracking-wider">{formatDuration(calculateDurationHours(day.in, day.out))}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="bg-white p-5 rounded-2xl border border-white shadow-sm hover:shadow-md transition-shadow">
                              <p className="text-[10px] text-slate-400 font-black uppercase mb-1.5 tracking-widest flex items-center gap-2">
                                <i className="fas fa-sign-in-alt text-green-500"></i>
                                Entrada
                              </p>
                              <p className="font-black text-slate-700 text-xl tracking-tight">{day.in ? new Date(day.in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-white shadow-sm hover:shadow-md transition-shadow">
                              <p className="text-[10px] text-slate-400 font-black uppercase mb-1.5 tracking-widest flex items-center gap-2">
                                <i className="fas fa-sign-out-alt text-red-500"></i>
                                Salida
                              </p>
                              <p className="font-black text-slate-700 text-xl tracking-tight">{day.out ? new Date(day.out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
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
                  onExportPDF={() => {
                    const doc = new jsPDF();
                    doc.setFontSize(20);
                    doc.text('Mi Historial Laboral', 14, 22);
                    doc.setFontSize(10);
                    doc.text(`Empleado: ${user.name}`, 14, 32);
                    doc.text(`Email: ${user.email}`, 14, 38);
                    const vacSummary = getVacationSummary(user);
                    doc.text(`Vacaciones: ${vacSummary.consumed} disfrutados / ${vacSummary.total} totales`, 14, 48);
                    const empRecords = records.filter(r => r.userId === user.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
                  }}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {user.role === UserRole.EMPLOYEE && (
        <div className="fixed bottom-8 left-0 right-0 z-50 flex justify-center px-6 no-print">
          <button
            disabled={
              absences.some(a => a.userId === user.id && a.date === new Date().toISOString().split('T')[0]) ||
              records.filter(r => r.userId === user.id && r.timestamp.startsWith(new Date().toISOString().split('T')[0])).length >= 2
            }
            onClick={() => setShowScanner(true)}
            className="w-full max-w-sm bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-[2.5rem] font-black shadow-[0_20px_40px_rgba(37,99,235,0.3)] flex items-center justify-center gap-4 active:scale-95 transition-all uppercase tracking-[0.2em] text-sm disabled:bg-slate-300 disabled:opacity-50 disabled:scale-100 disabled:shadow-none interactive-button"
          >
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <i className="fas fa-qrcode text-lg"></i>
            </div>
            {getDayStatusText()}
          </button>
        </div>
      )}

      {selectedEmployee && user.role === UserRole.ADMIN && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6 no-print">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => { setSelectedEmployee(null); setEditingVacationId(null); setVacationDate({ start: '', end: '' }); }}></div>
          <div className="bg-slate-50 w-full max-w-2xl rounded-t-[3rem] md:rounded-[3.5rem] shadow-[0_30px_90px_rgba(0,0,0,0.3)] relative z-10 overflow-hidden flex flex-col max-h-[92vh] animate-modal-in">
            <div className="p-8 md:p-10 bg-white border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-xl shadow-blue-600/20">
                  <i className="fas fa-user-tie"></i>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">{selectedEmployee.name}</h3>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mt-1">Perfil del Trabajador</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const doc = new jsPDF();
                    doc.setFontSize(20);
                    doc.text('Reporte de Empleado', 14, 22);
                    doc.setFontSize(10);
                    doc.text(`Nombre: ${selectedEmployee.name}`, 14, 32);
                    doc.text(`Email: ${selectedEmployee.email}`, 14, 38);
                    const stats = getWeeklyStats(selectedEmployee, records, isCurrentlyOnVacation(selectedEmployee), absences);
                    doc.text(`Horas esta semana: ${stats.total}`, 14, 44);
                    const empRecords = records.filter(r => r.userId === selectedEmployee.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                    autoTable(doc, {
                      startY: 55,
                      head: [['Fecha', 'Hora', 'Tipo']],
                      body: empRecords.map(r => [
                        new Date(r.timestamp).toLocaleDateString(),
                        new Date(r.timestamp).toLocaleTimeString(),
                        r.type
                      ]),
                    });
                    doc.save(`Reporte_${selectedEmployee.name}.pdf`);
                  }}
                  className="bg-slate-900 text-white w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-slate-800 transition-all"
                >
                  <i className="fas fa-file-pdf"></i>
                </button>
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-red-500 transition-all"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>
            <div className="p-8 md:p-10 overflow-y-auto bg-slate-50 space-y-8 custom-scrollbar">
              <ProductivityWidget employee={selectedEmployee} title="Productividad" records={records} absences={absences} />

              {/* Selector de Empresa */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-blue-100 transition-colors duration-500"></div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 relative z-10">
                  <i className="fas fa-building mr-2 text-blue-400"></i>
                  Empresa Asignada
                </h4>
                <div className="relative z-10">
                  <select
                    value={selectedEmployee.companyId || ''}
                    onChange={async (e) => {
                      const newCompanyId = e.target.value;
                      const updatedUser = { ...selectedEmployee, companyId: newCompanyId };
                      try {
                        await dbService.saveUserProfile(updatedUser);
                        setEmployees(employees.map(emp => emp.id === updatedUser.id ? updatedUser : emp));
                        setSelectedEmployee(updatedUser);
                        setFeedback({ type: 'success', msg: 'Empresa actualizada' });
                        setTimeout(() => setFeedback(null), 2000);
                      } catch (e) {
                        setFeedback({ type: 'error', msg: 'Error al actualizar empresa' });
                        setTimeout(() => setFeedback(null), 2000);
                      }
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
                    value={selectedEmployee.weeklyHours || 40}
                    onChange={async (e) => {
                      const newHours = parseInt(e.target.value) || 40;
                      const updatedUser = { ...selectedEmployee, weeklyHours: newHours };
                      try {
                        await dbService.saveUserProfile(updatedUser);
                        setEmployees(employees.map(emp => emp.id === updatedUser.id ? updatedUser : emp));
                        setSelectedEmployee(updatedUser);
                        setFeedback({ type: 'success', msg: `Horas actualizadas a ${newHours}h` });
                        setTimeout(() => setFeedback(null), 2000);
                      } catch (e) {
                        setFeedback({ type: 'error', msg: 'Error al actualizar' });
                        setTimeout(() => setFeedback(null), 2000);
                      }
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
                    value={selectedEmployee.totalVacationDays || 30}
                    onChange={async (e) => {
                      const newDays = parseInt(e.target.value) || 30;
                      const updatedUser = { ...selectedEmployee, totalVacationDays: newDays };
                      try {
                        await dbService.saveUserProfile(updatedUser);
                        setEmployees(employees.map(emp => emp.id === updatedUser.id ? updatedUser : emp));
                        setSelectedEmployee(updatedUser);
                        setFeedback({ type: 'success', msg: `Vacaciones anuales: ${newDays} días` });
                        setTimeout(() => setFeedback(null), 2000);
                      } catch (e) {
                        setFeedback({ type: 'error', msg: 'Error al actualizar' });
                        setTimeout(() => setFeedback(null), 2000);
                      }
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
                        setFeedback({ type: 'error', msg: 'Selecciona fechas' });
                        return;
                      }
                      const newVacation = { id: editingVacationId || Date.now().toString(), start: vacationDate.start, end: vacationDate.end };
                      const updatedVacations = editingVacationId
                        ? (selectedEmployee.vacations || []).map(v => v.id === editingVacationId ? newVacation : v)
                        : [...(selectedEmployee.vacations || []), newVacation];

                      const updatedUser = { ...selectedEmployee, vacations: updatedVacations };
                      try {
                        await dbService.saveUserProfile(updatedUser);
                        setEmployees(employees.map(emp => emp.id === updatedUser.id ? updatedUser : emp));
                        setSelectedEmployee(updatedUser);
                        setVacationDate({ start: '', end: '' });
                        setEditingVacationId(null);
                        setFeedback({ type: 'success', msg: editingVacationId ? 'Período actualizado' : 'Período añadido' });
                      } catch (e) { setFeedback({ type: 'error', msg: 'Error al guardar' }); }
                      setTimeout(() => setFeedback(null), 3000);
                    }}
                    className="w-full mt-6 bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/10 active:scale-95 transition-all"
                  >
                    {editingVacationId ? 'Guardar Cambios' : 'Añadir Período'}
                  </button>
                </div>

                {/* Listado de Vacaciones Actuales */}
                <div className="pt-8 border-t border-slate-50">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Períodos Registrados</h4>
                  <div className="space-y-3">
                    {selectedEmployee.vacations?.map((v, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-orange-200 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center shadow-inner">
                            <i className="fas fa-calendar-check"></i>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-800 uppercase tracking-wide">Vacaciones</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Del {v.start} al {v.end}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingVacationId(v.id); setVacationDate({ start: v.start, end: v.end }); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-slate-400 hover:text-blue-600 transition-all shadow-sm opacity-0 group-hover:opacity-100">
                            <i className="fas fa-pen text-[10px]"></i>
                          </button>
                          <button
                            onClick={async () => {
                              const updatedUser = { ...selectedEmployee, vacations: selectedEmployee.vacations?.filter(item => item.id !== v.id) };
                              try {
                                await dbService.saveUserProfile(updatedUser);
                                setEmployees(employees.map(emp => emp.id === updatedUser.id ? updatedUser : emp));
                                setSelectedEmployee(updatedUser);
                                setFeedback({ type: 'success', msg: 'Período eliminado' });
                              } catch (e) { setFeedback({ type: 'error', msg: 'Error al eliminar' }); }
                              setTimeout(() => setFeedback(null), 3000);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-slate-400 hover:text-red-500 transition-all shadow-sm opacity-0 group-hover:opacity-100"
                          >
                            <i className="fas fa-trash-alt text-[10px]"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                    {(!selectedEmployee.vacations || selectedEmployee.vacations.length === 0) && (
                      <div className="py-10 text-center opacity-30">
                        <i className="fas fa-umbrella-beach text-2xl mb-3 block"></i>
                        <p className="text-[8px] font-black uppercase tracking-[0.2em]">Sin vacaciones registradas</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ausencia */}
      {showAbsenceModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 no-print">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl" onClick={() => setShowAbsenceModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl relative z-10 overflow-hidden animate-modal-in">
            <div className="p-10 text-center">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center text-3xl mx-auto mb-8 shadow-inner">
                <i className="fas fa-calendar-times"></i>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Marcar Ausencia</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-10">Indica el motivo de tu ausencia para hoy</p>
              <div className="space-y-6 text-left">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Motivo de la ausencia</label>
                  <select
                    value={absenceFormData.predefinedReason}
                    onChange={(e) => setAbsenceFormData({ ...absenceFormData, predefinedReason: e.target.value })}
                    className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-600/20 transition-all"
                  >
                    <option>Baja médica</option>
                    <option>Asuntos propios</option>
                    <option>Familiar a cargo</option>
                    <option>Cita médica</option>
                    <option>Otro</option>
                  </select>
                </div>
                {absenceFormData.predefinedReason === 'Otro' && (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Especificar motivo</label>
                    <input
                      type="text"
                      placeholder="Ej: Trámites legales..."
                      value={absenceFormData.customReason}
                      onChange={(e) => setAbsenceFormData({ ...absenceFormData, customReason: e.target.value })}
                      className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-600/20 transition-all"
                    />
                  </div>
                )}
                <div className="flex gap-4 mt-12">
                  <button onClick={() => setShowAbsenceModal(false)} className="flex-1 bg-slate-50 text-slate-400 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">Cancelar</button>
                  <button onClick={handleSaveAbsence} className="flex-[2] bg-slate-900 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/10 active:scale-95 transition-all">Confirmar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Empresa */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 no-print">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl" onClick={() => setShowCompanyModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl relative z-10 overflow-hidden animate-modal-in">
            <div className="p-10 text-center">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center text-3xl mx-auto mb-8 shadow-inner">
                <i className="fas fa-building"></i>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">
                {isEditingCompany ? 'Editar Empresa' : 'Nueva Empresa'}
              </h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-10">Datos de la entidad</p>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const newCompany: Company = {
                  id: isEditingCompany ? companyFormData.id : Date.now().toString(),
                  name: companyFormData.name,
                  taxId: companyFormData.taxId,
                  createdAt: new Date().toISOString()
                };
                try {
                  await dbService.saveCompany(newCompany);
                  if (isEditingCompany) {
                    setCompanies(companies.map(c => c.id === newCompany.id ? newCompany : c));
                    setFeedback({ type: 'success', msg: 'Empresa actualizada' });
                  } else {
                    setCompanies([...companies, newCompany]);
                    setFeedback({ type: 'success', msg: 'Empresa creada' });
                  }
                  setShowCompanyModal(false);
                } catch (e) {
                  setFeedback({ type: 'error', msg: 'Error al guardar empresa' });
                }
                setTimeout(() => setFeedback(null), 3000);
              }} className="space-y-6 text-left">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nombre de la Empresa</label>
                  <input
                    type="text"
                    required
                    value={companyFormData.name}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, name: e.target.value })}
                    className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-600/20 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">CIF / Identificador Fiscal</label>
                  <input
                    type="text"
                    required
                    value={companyFormData.taxId}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, taxId: e.target.value })}
                    className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-600/20 transition-all"
                  />
                </div>

                <div className="flex gap-4 mt-12">
                  <button
                    type="button"
                    onClick={() => setShowCompanyModal(false)}
                    className="flex-1 bg-slate-50 text-slate-400 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] bg-slate-900 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/10 active:scale-95 transition-all"
                  >
                    {isEditingCompany ? 'Guardar Cambios' : 'Crear Empresa'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <div className="fixed inset-0 z-[500] flex flex-col bg-slate-900">
          <div className="p-6 flex justify-between items-center bg-slate-900/50 backdrop-blur-md border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
                <i className="fas fa-qrcode text-white text-xs"></i>
              </div>
              <h2 className="text-white font-black text-xs uppercase tracking-widest">Escáner de Acceso</h2>
            </div>
            <button onClick={() => setShowScanner(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-white/40 hover:text-white transition-all"><i className="fas fa-times"></i></button>
          </div>
          <div className="flex-1 relative flex items-center justify-center p-6">
            <div className="w-full max-w-sm aspect-square relative rounded-[3rem] overflow-hidden border-4 border-white/10 shadow-2xl">
              <div className="absolute inset-0 z-10 pointer-events-none border-[40px] border-slate-900/20"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-blue-500/50 rounded-3xl z-20 animate-pulse"></div>
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500/50 z-30 animate-[scan_2s_linear_infinite]"></div>
              <Scanner onScan={handleQrScan} onError={e => setFeedback({ type: 'error', msg: e })} />
            </div>
            <div className="absolute bottom-12 left-0 right-0 text-center px-10">
              <p className="text-white/40 font-black text-[10px] uppercase tracking-[0.2em] mb-4">Apunta al código QR del centro</p>
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 rounded-full border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-white/60 font-bold text-[9px] uppercase tracking-widest">Cámara Activa</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notificaciones Toaster */}
      {feedback && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[1000] px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-10 duration-500 ${feedback.type === 'success' ? 'bg-slate-900 text-white border border-white/10' : 'bg-red-600 text-white'
          }`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${feedback.type === 'success' ? 'bg-blue-600' : 'bg-white/20'}`}>
            <i className={`fas ${feedback.type === 'success' ? 'fa-check' : 'fa-exclamation'}`}></i>
          </div>
          <p className="font-black text-[10px] uppercase tracking-widest whitespace-nowrap">{feedback.msg}</p>
        </div>
      )}
    </div>
  );
};

export default App;