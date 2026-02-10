import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, AttendanceRecord, RecordType } from './types';
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
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'employees' | 'settings' | 'reports'>('history');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [vacationDate, setVacationDate] = useState({ start: '', end: '' });
  const [editingVacationId, setEditingVacationId] = useState<string | null>(null);

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
      const [recs, emps] = await Promise.all([
        dbService.getRecords(currentUser.role === UserRole.ADMIN ? undefined : currentUser.id),
        currentUser.role === UserRole.ADMIN ? dbService.getEmployees() : Promise.resolve([])
      ]);
      setRecords(recs);
      setEmployees(emps);
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

  const getDayStatusText = () => {
    if (!user) return '';
    const today = new Date().toISOString().split('T')[0];
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
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="bg-white p-6 shadow-sm flex justify-between items-center sticky top-0 z-50 border-b border-gray-100">
        <h1 className="font-black text-xl text-blue-600 uppercase tracking-tighter">Control de Acceso</h1>
        <button onClick={() => {
          signOut(auth);
          setFeedback({ type: 'success', msg: 'Sesión cerrada correctamente' });
          setTimeout(() => setFeedback(null), 2000);
        }} className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center"><i className="fas fa-power-off"></i></button>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {user.role === UserRole.ADMIN ? (
          <div className="space-y-6">
            <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
              {(['history', 'employees', 'reports', 'settings'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400'}`}>{tab}</button>
              ))}
            </div>

            {activeTab === 'history' && (
              <div className="space-y-3">
                {records.slice(0, 15).map((rec, i) => (
                  <div key={i} className="bg-white p-4 rounded-3xl flex items-center justify-between border border-gray-100 shadow-sm">
                    <div><p className="font-bold text-sm text-gray-800">{rec.userName}</p><p className="text-[9px] text-gray-400 font-black uppercase">{new Date(rec.timestamp).toLocaleString()}</p></div>
                    <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${rec.type === RecordType.IN ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{rec.type}</span>
                  </div>
                ))}D
              </div>
            )}

            {activeTab === 'employees' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {employees.map(emp => {
                  const status = getEmployeeStatus(emp, records);
                  return (
                    <div key={emp.id} onClick={() => setSelectedEmployee(emp)} className={`p-6 rounded-[2.5rem] border cursor-pointer relative transition-all hover:border-blue-300 ${status.bg} ${status.border} shadow-sm`}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-black text-gray-800 text-sm uppercase truncate flex-1">{emp.name}</h4>
                        <span className="text-sm">{status.icon}</span>
                      </div>
                      <div className={`text-[9px] font-black uppercase ${status.color} flex items-center gap-2`}>
                        <div className={`w-2 h-2 rounded-full ${status.label === 'Trabajando' ? 'bg-green-500 animate-pulse' : status.label === 'Inactivo' ? 'bg-gray-300' : 'bg-orange-400'}`}></div>
                        {status.label}
                      </div>
                      <p className="text-[9px] text-gray-400 font-bold uppercase mt-2 border-t pt-2 border-dashed border-gray-200">{emp.weeklyHours || 40}H/Sem</p>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'reports' && (
              <ReportsTab records={records} employees={employees} />
            )}

            {activeTab === 'settings' && (
              <div className="bg-white p-10 rounded-[3rem] text-center border border-gray-100 max-w-md mx-auto shadow-sm">
                <h3 className="font-black text-gray-800 mb-6 uppercase tracking-widest text-xs">Punto de Acceso Oficial</h3>
                <div className="flex justify-center p-6 bg-gray-50 rounded-3xl mb-6 shadow-inner" ref={qrContainerRef}></div>
                <button onClick={() => window.print()} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">Imprimir QR</button>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-md mx-auto space-y-8">
            <ProductivityWidget employee={user} title="Mi Actividad" records={records} />

            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 mb-3">Vacaciones Programadas</h3>
              <div className="space-y-2">
                {user.vacations?.map((v, i) => (
                  <div key={i} className="bg-white p-4 rounded-2xl flex items-center gap-4 border border-gray-100">
                    <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center text-xs"><i className="fas fa-calendar-alt"></i></div>
                    <span className="text-[10px] font-black text-gray-700 uppercase">Del {v.start} al {v.end}</span>
                  </div>
                ))}
                {(!user.vacations || user.vacations.length === 0) && <p className="text-center text-[9px] font-bold text-gray-300 uppercase py-4 border-2 border-dashed border-gray-100 rounded-3xl">Sin vacaciones</p>}
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 mb-3">Historial Personal</h3>
              <div className="space-y-3">
                {getGroupedRecords(user.id, records).map((day: any, i) => (
                  <div key={i} className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs font-black text-gray-800 uppercase">{new Date(day.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}</span>
                      <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full">{formatDuration(calculateDurationHours(day.in, day.out))}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 p-3 rounded-2xl text-center"><p className="text-[8px] text-gray-400 font-black uppercase">Entrada</p><p className="font-black text-gray-700">{day.in ? new Date(day.in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p></div>
                      <div className="bg-gray-50 p-3 rounded-2xl text-center"><p className="text-[8px] text-gray-400 font-black uppercase">Salida</p><p className="font-black text-gray-700">{day.out ? new Date(day.out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {user.role === UserRole.EMPLOYEE && (
        <div className="fixed bottom-8 left-8 right-8 z-50">
          <button
            disabled={records.filter(r => r.userId === user.id && r.timestamp.startsWith(new Date().toISOString().split('T')[0])).length >= 2}
            onClick={() => setShowScanner(true)}
            className="w-full bg-blue-600 text-white py-5 rounded-[2.2rem] font-black shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all uppercase tracking-widest text-sm disabled:bg-gray-400 disabled:opacity-50 disabled:scale-100"
          >
            <i className="fas fa-qrcode text-xl"></i> {getDayStatusText()}
          </button>
        </div>
      )}

      {selectedEmployee && user.role === UserRole.ADMIN && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setSelectedEmployee(null); setEditingVacationId(null); setVacationDate({ start: '', end: '' }); }}></div>
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase">{selectedEmployee.name}</h3>
              <div className="flex gap-2">
                <button onClick={() => {
                  const doc = new jsPDF();

                  // Header
                  doc.setFontSize(20);
                  doc.text('Reporte de Empleado', 14, 22);

                  doc.setFontSize(10);
                  doc.text(`Nombre: ${selectedEmployee.name}`, 14, 32);
                  doc.text(`Email: ${selectedEmployee.email}`, 14, 38);
                  doc.text(`Horas Semanales: ${selectedEmployee.weeklyHours || 40}h`, 14, 44);
                  doc.text(`Fecha Reporte: ${new Date().toLocaleDateString()}`, 14, 50);

                  // Stats
                  const stats = getWeeklyStats(selectedEmployee, records, isCurrentlyOnVacation(selectedEmployee));
                  doc.text(`Horas esta semana: ${stats.total}`, 14, 60);
                  doc.text(`Estado actual: ${getEmployeeStatus(selectedEmployee, records).label}`, 14, 66);

                  // Table
                  const empRecords = records.filter(r => r.userId === selectedEmployee.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                  autoTable(doc, {
                    startY: 75,
                    head: [['Fecha', 'Hora', 'Tipo', 'Ubicación']],
                    body: empRecords.map(r => [
                      new Date(r.timestamp).toLocaleDateString(),
                      new Date(r.timestamp).toLocaleTimeString(),
                      r.type,
                      r.location || '-' // Use location falling back to -
                    ]),
                  });

                  doc.save(`Reporte_${selectedEmployee.name.replace(/\s+/g, '_')}.pdf`);
                }} className="bg-white/20 hover:bg-white/30 text-white w-8 h-8 flex items-center justify-center rounded-lg transition-all" title="Exportar PDF">
                  <i className="fas fa-file-pdf"></i>
                </button>
                <button onClick={() => { setSelectedEmployee(null); setEditingVacationId(null); setVacationDate({ start: '', end: '' }); }}><i className="fas fa-times text-xl"></i></button>
              </div>
            </div>
            <div className="p-8 overflow-y-auto bg-gray-50 space-y-6">
              <ProductivityWidget employee={selectedEmployee} title="Productividad" records={records} />

              {/* Editor de Horas Semanales */}
              <div className="bg-white p-6 rounded-3xl border border-gray-100">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">
                  Horas Semanales
                </h4>
                <div className="flex items-center gap-4">
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
                        setFeedback({ type: 'success', msg: `Horas semanales actualizadas a ${newHours}h` });
                        setTimeout(() => setFeedback(null), 2000);
                      } catch (e) {
                        setFeedback({ type: 'error', msg: 'Error al actualizar horas' });
                        setTimeout(() => setFeedback(null), 2000);
                      }
                    }}
                    className="w-24 p-3 bg-gray-50 rounded-xl text-center text-lg font-black border-none"
                  />
                  <div>
                    <p className="text-xs font-bold text-gray-800">Horas por semana</p>
                    <p className="text-[9px] text-gray-400 font-bold">Ajusta las horas de trabajo semanales</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">
                  {editingVacationId ? 'Editar Vacaciones' : 'Planificar Vacaciones'}
                </h4>

                {/* Lista de vacaciones existentes */}
                {selectedEmployee.vacations && selectedEmployee.vacations.length > 0 && (
                  <div className="mb-6 space-y-2">
                    {selectedEmployee.vacations.map((v) => (
                      <div key={v.id || v.start + v.end} className={`flex items-center justify-between p-3 rounded-xl border ${editingVacationId === v.id ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'}`}>
                        <span className="text-xs font-bold text-gray-600">
                          {new Date(v.start).toLocaleDateString()} - {new Date(v.end).toLocaleDateString()}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingVacationId(v.id!);
                              setVacationDate({ start: v.start, end: v.end });
                            }}
                            className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                          >
                            <i className="fas fa-pen text-xs"></i>
                          </button>
                          <button
                            onClick={async () => {
                              if (!window.confirm("¿Eliminar este periodo de vacaciones?")) return;
                              const updatedVacations = selectedEmployee.vacations!.filter(item => item.id !== v.id);
                              const updatedUser = { ...selectedEmployee, vacations: updatedVacations };
                              try {
                                await dbService.saveUserProfile(updatedUser);
                                setEmployees(employees.map(emp => emp.id === updatedUser.id ? updatedUser : emp));
                                setSelectedEmployee(updatedUser);
                                setFeedback({ type: 'success', msg: 'Periodo de vacaciones eliminado' });
                                if (editingVacationId === v.id) {
                                  setEditingVacationId(null);
                                  setVacationDate({ start: '', end: '' });
                                }
                              } catch (e) {
                                setFeedback({ type: 'error', msg: 'Error al eliminar vacaciones' });
                              }
                              setTimeout(() => setFeedback(null), 3000);
                            }}
                            className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all"
                          >
                            <i className="fas fa-trash text-xs"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 mb-4">
                  <input type="date" value={vacationDate.start} onChange={e => setVacationDate({ ...vacationDate, start: e.target.value })} className="flex-1 p-3 bg-gray-50 rounded-xl text-xs font-bold border-none" />
                  <input type="date" value={vacationDate.end} onChange={e => setVacationDate({ ...vacationDate, end: e.target.value })} className="flex-1 p-3 bg-gray-50 rounded-xl text-xs font-bold border-none" />
                </div>

                <div className="flex gap-2">
                  {editingVacationId && (
                    <button
                      onClick={() => {
                        setEditingVacationId(null);
                        setVacationDate({ start: '', end: '' });
                      }}
                      className="flex-1 bg-gray-200 text-gray-600 py-3 rounded-xl font-black text-[10px] uppercase shadow-sm"
                    >
                      Cancelar
                    </button>
                  )}
                  <button onClick={async () => {
                    if (!vacationDate.start || !vacationDate.end) return;

                    let updatedVacations = [...(selectedEmployee.vacations || [])];

                    if (editingVacationId) {
                      // Actualizar existente
                      updatedVacations = updatedVacations.map(v =>
                        v.id === editingVacationId
                          ? { ...v, start: vacationDate.start, end: vacationDate.end }
                          : v
                      );
                    } else {
                      // Crear nuevo
                      updatedVacations.push({
                        id: Date.now().toString(),
                        start: vacationDate.start,
                        end: vacationDate.end
                      });
                    }

                    const updatedUser = { ...selectedEmployee, vacations: updatedVacations };
                    await dbService.saveUserProfile(updatedUser);

                    setEmployees(employees.map(emp => emp.id === updatedUser.id ? updatedUser : emp));
                    setSelectedEmployee(updatedUser);
                    setVacationDate({ start: '', end: '' });
                    setEditingVacationId(null);
                    setFeedback({ type: 'success', msg: editingVacationId ? 'Periodo actualizado' : 'Periodo añadido' });
                    setTimeout(() => setFeedback(null), 2000);
                  }} className="flex-2 w-full bg-blue-600 text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-md">
                    {editingVacationId ? 'Actualizar Rango' : 'Añadir Rango'}
                  </button>
                </div>
              </div>

              <button onClick={async () => {
                if (window.confirm("¿Eliminar empleado permanentemente?")) {
                  try {
                    await dbService.deleteUser(selectedEmployee.id);
                    setEmployees(employees.filter(e => e.id !== selectedEmployee.id));
                    setSelectedEmployee(null);
                    setFeedback({ type: 'success', msg: 'Empleado eliminado' });
                  } catch (e) {
                    setFeedback({ type: 'error', msg: 'Error al eliminar empleado' });
                  }
                  setTimeout(() => setFeedback(null), 3000);
                }
              }} className="w-full bg-red-50 text-red-500 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-red-500 hover:text-white transition-all">Eliminar Empleado</button>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center pointer-events-none">
          <div className={`
            px-8 py-4 rounded-3xl font-black text-[10px] uppercase shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300
            ${feedback.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}
          `}>
            {feedback.type === 'success' ? '✅' : '❌'} {feedback.msg}
          </div>
        </div>
      )}
      {showScanner && <Scanner onScan={handleQrScan} onCancel={() => setShowScanner(false)} />}
    </div>
  );
};

export default App;