import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, AttendanceRecord, RecordType, Absence } from './types';
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
import { calculateDurationHours, formatDuration, getGroupedRecords, getWeeklyStats } from './utils/timeCalculations';
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
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'employees' | 'settings' | 'reports'>('history');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [vacationDate, setVacationDate] = useState({ start: '', end: '' });
  const [editingVacationId, setEditingVacationId] = useState<string | null>(null);

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
        // Obtenemos el token para verificar los Custom Claims (roles seguros)
        const idTokenResult = await firebaseUser.getIdTokenResult();
        const roleFromClaim = idTokenResult.claims.role as UserRole | undefined;

        const profile = await dbService.getUserProfile(firebaseUser.uid);
        if (profile) {
          // Priorizamos el rol del Claim (autorización) sobre el de Firestore (display)
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
      const [recs, emps, abs] = await Promise.all([
        dbService.getRecords(isAdmin ? undefined : currentUser.id),
        isAdmin ? dbService.getEmployees() : Promise.resolve([]),
        dbService.getAbsences(isAdmin ? undefined : currentUser.id)
      ]);
      setRecords(recs);
      setEmployees(emps);
      setAbsences(abs);
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

    // Validar Ausencia
    const absence = absences.find(a => a.userId === user.id && a.date === today);
    if (absence) {
      setFeedback({ type: 'error', msg: 'Día marcado como AUSENTE. No puedes fichar hoy.' });
      return;
    }

    const userToday = records.filter(r => r.userId === user.id && r.timestamp.startsWith(today));

    // logic: max 2 records per day (one IN, one OUT)
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

    // Validar si ya hay registros hoy
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
      <header className="bg-white/80 backdrop-blur-md p-6 shadow-sm flex justify-between items-center sticky top-0 z-50 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <i className="fas fa-clock text-white"></i>
          </div>
          <div>
            <h1 className="font-black text-lg text-slate-900 leading-none">QR Control</h1>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Smart Attendance</p>
          </div>
        </div>
        <button onClick={() => {
          signOut(auth);
          setFeedback({ type: 'success', msg: 'Sesión cerrada correctamente' });
          setTimeout(() => setFeedback(null), 2000);
        }} className="group flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all font-bold text-xs">
          <span className="hidden sm:block">Cerrar Sesión</span>
          <i className="fas fa-power-off transition-transform group-hover:rotate-12"></i>
        </button>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {user.role === UserRole.ADMIN ? (
          <div className="space-y-8">
            {/* Navegación - Segmented Control */}
            <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 flex gap-1">
              {(['history', 'employees', 'reports', 'settings'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 ${activeTab === tab
                    ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <i className={`fas ${tab === 'history' ? 'fa-list' :
                      tab === 'employees' ? 'fa-users' :
                        tab === 'reports' ? 'fa-chart-bar' : 'fa-cog'
                      } text-[10px] ${activeTab === tab ? 'text-blue-400' : 'text-slate-300'}`}></i>
                    {tab}
                  </span>
                </button>
              ))}
            </div>

            {activeTab === 'history' && (
              <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {records.slice(0, 15).map((rec, i) => (
                  <div key={i} className="group bg-white p-5 rounded-3xl flex items-center justify-between border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/40 hover:-translate-y-0.5 transition-all outline-none focus:ring-2 focus:ring-blue-600/10">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in zoom-in-95 duration-500">
                {employees.map(emp => {
                  const status = getEmployeeStatus(emp, records, absences);
                  return (
                    <div
                      key={emp.id}
                      onClick={() => setSelectedEmployee(emp)}
                      className={`group p-6 rounded-[2.5rem] border-2 cursor-pointer relative transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 hover:border-blue-500/10 ${status.label === 'Trabajando' ? 'bg-white border-green-500/10 hover:shadow-green-500/5' :
                        status.label === 'Inactivo' ? 'bg-white border-slate-100' : 'bg-white border-orange-500/10 hover:shadow-orange-500/5'
                        } shadow-sm`}
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
          <div className="max-w-md mx-auto space-y-8">
            <ProductivityWidget employee={user} title="Mi Actividad" records={records} absences={absences} />

            <div className="flex gap-4 no-print">
              <button
                onClick={() => setShowAbsenceModal(true)}
                className="flex-1 bg-white hover:bg-red-50 text-red-500 py-5 rounded-[2.5rem] font-black border-2 border-red-100 shadow-sm transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 active:scale-95"
              >
                <i className="fas fa-calendar-times"></i>
                Marcar Ausencia
              </button>
            </div>

            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-6 mb-4">Vacaciones Programadas</h3>
              <div className="space-y-3">
                {user.vacations?.map((v, i) => (
                  <div key={i} className="group bg-white p-5 rounded-[2rem] flex items-center gap-5 border border-slate-100 shadow-sm hover:shadow-md transition-all">
                    <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center text-lg group-hover:bg-orange-500 group-hover:text-white transition-colors"><i className="fas fa-calendar-check"></i></div>
                    <div>
                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Período de Descanso</p>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5 block">Del {v.start} al {v.end}</span>
                    </div>
                  </div>
                ))}
                {(!user.vacations || user.vacations.length === 0) && (
                  <div className="flex flex-col items-center justify-center p-12 bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[2.5rem] opacity-60">
                    <i className="fas fa-umbrella-beach text-3xl text-slate-200 mb-3"></i>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Sin períodos activos</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-6 mb-4">Historial Personal</h3>
              <div className="space-y-4">
                {/* Fusionar registros de asistencia y ausencias */}
                {(() => {
                  const grouped = getGroupedRecords(user.id, records);
                  const userAbsences = absences.filter(a => a.userId === user.id);
                  const allDays = [...grouped];

                  userAbsences.forEach(abs => {
                    if (!allDays.find((d: any) => d.date === abs.date)) {
                      allDays.push({ date: abs.date, isAbsence: true, absence: abs });
                    }
                  });

                  return allDays.sort((a: any, b: any) => b.date.localeCompare(a.date)).map((day: any, i) => (
                    <div key={i} className={`group p-6 rounded-[2.5rem] border transition-all ${day.isAbsence ? 'bg-red-50/30 border-red-100' : 'bg-white border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-600/5'}`}>
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] ${day.isAbsence ? 'bg-red-100 text-red-500' : 'bg-blue-50 text-blue-600'}`}>
                            <i className={`fas ${day.isAbsence ? 'fa-calendar-times' : 'fa-calendar-day'}`}></i>
                          </div>
                          <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{new Date(day.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                        </div>
                        {day.isAbsence ? (
                          <span className="text-[9px] font-black bg-red-500 text-white px-4 py-1.5 rounded-full shadow-lg shadow-red-900/10 uppercase tracking-wider">AUSENTE</span>
                        ) : (
                          <span className="text-[10px] font-black bg-slate-900 text-white px-4 py-1.5 rounded-full shadow-lg shadow-slate-900/10 uppercase tracking-wider">{formatDuration(calculateDurationHours(day.in, day.out))}</span>
                        )}
                      </div>

                      {day.isAbsence ? (
                        <div className="bg-white/50 p-4 rounded-2xl border border-red-100">
                          <p className="text-[9px] text-red-400 font-black uppercase tracking-widest mb-1 shadow-sm">Motivo:</p>
                          <p className="font-bold text-slate-700 text-sm">{day.absence.predefinedReason === 'Otro' ? day.absence.customReason : day.absence.predefinedReason}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 p-4 rounded-2xl border border-transparent transition-colors group-hover:bg-green-50/50 group-hover:border-green-100">
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                              <i className="fas fa-arrow-right-to-bracket text-green-500"></i>
                              Entrada
                            </p>
                            <p className="font-black text-slate-700 text-lg tracking-tight">{day.in ? new Date(day.in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-2xl border border-transparent transition-colors group-hover:bg-red-50/50 group-hover:border-red-100">
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                              <i className="fas fa-arrow-right-from-bracket text-red-500"></i>
                              Salida
                            </p>
                            <p className="font-black text-slate-700 text-lg tracking-tight">{day.out ? new Date(day.out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ));
                })()}
              </div>
            </div>
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
            className="w-full max-w-sm bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-[2.5rem] font-black shadow-[0_20px_40px_rgba(37,99,235,0.3)] flex items-center justify-center gap-4 active:scale-95 transition-all uppercase tracking-[0.2em] text-sm disabled:bg-slate-300 disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
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
          <div className="bg-slate-50 w-full max-w-2xl rounded-t-[3rem] md:rounded-[3.5rem] shadow-[0_30px_90px_rgba(0,0,0,0.3)] relative z-10 overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-20 duration-500 ease-out">
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
                    // ... (logica de PDF intacta)
                    doc.setFontSize(20);
                    doc.text('Reporte de Empleado', 14, 22);
                    doc.setFontSize(10);
                    doc.text(`Nombre: ${selectedEmployee.name}`, 14, 32);
                    doc.text(`Email: ${selectedEmployee.email}`, 14, 38);
                    doc.text(`Horas Semanales: ${selectedEmployee.weeklyHours || 40}h`, 14, 44);
                    doc.text(`Fecha Reporte: ${new Date().toLocaleDateString()}`, 14, 50);
                    const stats = getWeeklyStats(selectedEmployee, records, isCurrentlyOnVacation(selectedEmployee), absences);
                    doc.text(`Horas esta semana: ${stats.total}`, 14, 60);
                    const statusObj = getEmployeeStatus(selectedEmployee, records, absences);
                    doc.text(`Estado actual: ${statusObj.label}${statusObj.reason ? ` (${statusObj.reason})` : ''}`, 14, 66);
                    const empRecords = records.filter(r => r.userId === selectedEmployee.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                    autoTable(doc, {
                      startY: 75,
                      head: [['Fecha', 'Hora', 'Tipo', 'Ubicación']],
                      body: empRecords.map(r => [
                        new Date(r.timestamp).toLocaleDateString(),
                        new Date(r.timestamp).toLocaleTimeString(),
                        r.type,
                        r.location || '-'
                      ]),
                    });
                    doc.save(`Reporte_${selectedEmployee.name.replace(/\s+/g, '_')}.pdf`);
                  }}
                  className="bg-slate-900 text-white w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-slate-800 shadow-lg shadow-slate-900/10 transition-all group"
                  title="Exportar PDF Completo"
                >
                  <i className="fas fa-file-pdf transition-transform group-hover:scale-110"></i>
                </button>
                <button
                  onClick={() => { setSelectedEmployee(null); setEditingVacationId(null); setVacationDate({ start: '', end: '' }); }}
                  className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 shadow-sm transition-all"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>
            <div className="p-8 md:p-10 overflow-y-auto bg-slate-50 space-y-8 custom-scrollbar">
              <ProductivityWidget employee={selectedEmployee} title="Productividad" records={records} absences={absences} />

              {/* Editor de Horas Semanales */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-blue-100 transition-colors duration-500"></div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 relative z-10">
                  <i className="fas fa-hourglass-half mr-2 text-blue-400"></i>
                  Carga Horaria Semanal
                </h4>
                <div className="flex items-center gap-6 relative z-10">
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="168"
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
                      className="w-24 p-4 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-center text-xl font-black text-slate-900 outline-none focus:bg-white focus:border-blue-600/20 transition-all font-outfit"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 tracking-tight">Horas Estimadas</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Calculado para balance semanal</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">
                  <i className="fas fa-plane-departure mr-2 text-orange-400"></i>
                  {editingVacationId ? 'Editar Periodo' : 'Planificar Vacaciones'}
                </h4>

                {/* Lista de vacaciones existentes */}
                {selectedEmployee.vacations && selectedEmployee.vacations.length > 0 && (
                  <div className="mb-8 space-y-3">
                    {selectedEmployee.vacations.map((v) => (
                      <div key={v.id || v.start + v.end} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 ${editingVacationId === v.id ? 'bg-blue-50/50 border-blue-600/20 shadow-lg shadow-blue-500/5' : 'bg-slate-50 border-transparent hover:border-slate-100'}`}>
                        <div className="flex items-center gap-3">
                          <i className={`fas fa-circle text-[6px] ${editingVacationId === v.id ? 'text-blue-500 animate-pulse' : 'text-slate-300'}`}></i>
                          <span className="text-xs font-black text-slate-700 tracking-tight">
                            {new Date(v.start).toLocaleDateString()} &mdash; {new Date(v.end).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingVacationId(v.id!);
                              setVacationDate({ start: v.start, end: v.end });
                            }}
                            className="w-9 h-9 flex items-center justify-center bg-white text-blue-600 rounded-xl border border-slate-100 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm transition-all"
                            title="Editar"
                          >
                            <i className="fas fa-pen text-xs"></i>
                          </button>
                          <button
                            onClick={async () => {
                              if (!window.confirm("¿Eliminar este periodo?")) return;
                              const updatedVacations = selectedEmployee.vacations!.filter(item => item.id !== v.id);
                              const updatedUser = { ...selectedEmployee, vacations: updatedVacations };
                              try {
                                // Aquí no necesitamos cambiar dbService porque las vacaciones están integradas en el profile
                                await dbService.saveUserProfile(updatedUser);
                                setEmployees(employees.map(emp => emp.id === updatedUser.id ? updatedUser : emp));
                                setSelectedEmployee(updatedUser);
                                setFeedback({ type: 'success', msg: 'Periodo eliminado' });
                                if (editingVacationId === v.id) {
                                  setEditingVacationId(null);
                                  setVacationDate({ start: '', end: '' });
                                }
                              } catch (e) {
                                setFeedback({ type: 'error', msg: 'Error al eliminar' });
                              }
                              setTimeout(() => setFeedback(null), 3000);
                            }}
                            className="w-9 h-9 flex items-center justify-center bg-white text-red-500 rounded-xl border border-slate-100 hover:bg-red-500 hover:text-white hover:border-red-500 shadow-sm transition-all"
                            title="Eliminar"
                          >
                            <i className="fas fa-trash-alt text-xs"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Fecha Inicio</label>
                    <input type="date" value={vacationDate.start} onChange={e => setVacationDate({ ...vacationDate, start: e.target.value })} className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl text-[11px] font-black text-slate-700 outline-none focus:bg-white focus:border-blue-600/20 transition-all font-outfit" />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Fecha Fin</label>
                    <input type="date" value={vacationDate.end} onChange={e => setVacationDate({ ...vacationDate, end: e.target.value })} className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl text-[11px] font-black text-slate-700 outline-none focus:bg-white focus:border-blue-600/20 transition-all font-outfit" />
                  </div>
                </div>

                <div className="flex gap-3">
                  {editingVacationId && (
                    <button
                      onClick={() => {
                        setEditingVacationId(null);
                        setVacationDate({ start: '', end: '' });
                      }}
                      className="flex-1 bg-white border border-slate-100 text-slate-400 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
                    >
                      Cancelar
                    </button>
                  )}
                  <button onClick={async () => {
                    if (!vacationDate.start || !vacationDate.end) return;
                    let updatedVacations = [...(selectedEmployee.vacations || [])];
                    if (editingVacationId) {
                      updatedVacations = updatedVacations.map(v => v.id === editingVacationId ? { ...v, start: vacationDate.start, end: vacationDate.end } : v);
                    } else {
                      updatedVacations.push({ id: Date.now().toString(), start: vacationDate.start, end: vacationDate.end });
                    }
                    const updatedUser = { ...selectedEmployee, vacations: updatedVacations };
                    await dbService.saveUserProfile(updatedUser);
                    setEmployees(employees.map(emp => emp.id === updatedUser.id ? updatedUser : emp));
                    setSelectedEmployee(updatedUser);
                    setVacationDate({ start: '', end: '' });
                    setEditingVacationId(null);
                    setFeedback({ type: 'success', msg: editingVacationId ? 'Periodo actualizado' : 'Periodo añadido' });
                    setTimeout(() => setFeedback(null), 2000);
                  }} className="flex-[2] bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/10 active:scale-[0.98] transition-all">
                    {editingVacationId ? 'Guardar Cambios' : 'Asignar Vacaciones'}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={async () => {
                    if (window.confirm("¿Aplicar baja laboral (Soft Delete)? El usuario no podrá entrar pero sus datos se conservarán por motivos legales.")) {
                      try {
                        await dbService.softDeleteUser(selectedEmployee.id);
                        setEmployees(employees.filter(e => e.id !== selectedEmployee.id));
                        setSelectedEmployee(null);
                        setFeedback({ type: 'success', msg: 'Usuario dado de baja' });
                      } catch (e) {
                        setFeedback({ type: 'error', msg: 'Error al dar de baja' });
                      }
                      setTimeout(() => setFeedback(null), 3000);
                    }
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-3xl font-black text-[11px] uppercase tracking-widest transition-all"
                >
                  Dar de Baja (Legal / Soft Delete)
                </button>

                <button
                  onClick={async () => {
                    if (window.confirm("¿ELIMINAR PERMANENTEMENTE? Esta acción borrará todos los fichajes, ausencias y la cuenta de acceso. No se puede deshacer.")) {
                      try {
                        await dbService.deleteUserCompletely(selectedEmployee.id);
                        setEmployees(employees.filter(e => e.id !== selectedEmployee.id));
                        setSelectedEmployee(null);
                        setFeedback({ type: 'success', msg: 'Eliminado permanentemente' });
                      } catch (e) {
                        setFeedback({ type: 'error', msg: 'Error al eliminar completamente' });
                      }
                      setTimeout(() => setFeedback(null), 3000);
                    }
                  }}
                  className="w-full bg-red-50 hover:bg-red-500 text-red-500 hover:text-white py-4 md:py-5 rounded-3xl font-black text-[11px] uppercase tracking-widest transition-all duration-300 border border-transparent hover:shadow-xl hover:shadow-red-500/20 active:scale-[0.98]"
                >
                  Eliminar Todo (Hard Delete)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[500] flex flex-col items-center pointer-events-none w-full max-w-xs px-6">
          <div className={`
            px-8 py-4 rounded-3xl font-black text-[11px] uppercase tracking-widest shadow-2xl animate-in fade-in zoom-in slide-in-from-top-4 duration-500 backdrop-blur-md border flex items-center gap-3
            ${feedback.type === 'success' ? 'bg-slate-900/90 text-white border-white/10' : 'bg-red-600/90 text-white border-white/10'}
          `}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${feedback.type === 'success' ? 'bg-green-500' : 'bg-red-400'}`}>
              <i className={feedback.type === 'success' ? 'fas fa-check' : 'fas fa-xmark'}></i>
            </div>
            {feedback.msg}
          </div>
        </div>
      )}
      {showScanner && <Scanner onScan={handleQrScan} onCancel={() => setShowScanner(false)} />}

      {/* MODAL DE AUSENCIA */}
      {showAbsenceModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 no-print">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl" onClick={() => setShowAbsenceModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 text-center">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center text-3xl mx-auto mb-8 shadow-inner">
                <i className="fas fa-calendar-times"></i>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Marcar Ausencia</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-10">¿No puedes asistir hoy?</p>

              <div className="space-y-6 text-left">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Motivo de la Ausencia</label>
                  <select
                    value={absenceFormData.predefinedReason}
                    onChange={(e) => setAbsenceFormData({ ...absenceFormData, predefinedReason: e.target.value })}
                    className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-red-600/20 transition-all appearance-none cursor-pointer"
                  >
                    <option>Baja médica</option>
                    <option>Vacaciones</option>
                    <option>Asunto personal</option>
                    <option>Formación</option>
                    <option>Permiso retribuido</option>
                    <option>Permiso no retribuido</option>
                    <option>Otro</option>
                  </select>
                </div>

                {absenceFormData.predefinedReason === 'Otro' && (
                  <div className="space-y-2 animate-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Especifica el motivo</label>
                    <input
                      type="text"
                      placeholder="Escribe aquí..."
                      value={absenceFormData.customReason}
                      onChange={(e) => setAbsenceFormData({ ...absenceFormData, customReason: e.target.value })}
                      className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-red-600/20 transition-all"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-4 mt-12">
                <button
                  onClick={() => setShowAbsenceModal(false)}
                  className="flex-1 bg-slate-50 text-slate-400 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button
                  disabled={absenceFormData.predefinedReason === 'Otro' && !absenceFormData.customReason}
                  onClick={handleSaveAbsence}
                  className="flex-[2] bg-slate-900 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/10 active:scale-95 transition-all disabled:opacity-50"
                >
                  Confirmar Ausencia
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;