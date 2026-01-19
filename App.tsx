
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, UserRole, AttendanceRecord, RecordType, AdminSettings } from './types';
import { mockDb } from './services/mockDb';
import Scanner from './components/Scanner';

declare const jspdf: any;
declare const QRCode: any;

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'employees' | 'settings'>('history');
  
  // Offline Sync State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [offlineCount, setOfflineCount] = useState(mockDb.getOfflineCount());

  // QR Generation State
  const [qrText, setQrText] = useState('ACCESS_POINT_001');
  const qrContainerRef = useRef<HTMLDivElement>(null);

  // Customization Settings
  const [settings, setSettings] = useState<AdminSettings>({
    primaryColor: '#E20613',
    layoutDensity: 'spacious',
    showSummary: true
  });

  // Estado para ver detalle de un empleado (Admin)
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);

  // Filtros de fecha
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    if (user) loadData();
    const savedSettings = localStorage.getItem('access_admin_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));

    const handleStatusChange = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, [user]);

  useEffect(() => {
    if (isOnline && offlineCount > 0 && !isSyncing) {
      handleSync();
    }
  }, [isOnline, offlineCount]);

  useEffect(() => {
    if (activeTab === 'settings' && qrContainerRef.current) {
      qrContainerRef.current.innerHTML = '';
      new QRCode(qrContainerRef.current, {
        text: qrText,
        width: 180,
        height: 180,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    }
  }, [activeTab, qrText]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await mockDb.syncOfflineRecords();
      setOfflineCount(0);
      loadData();
    } catch (e) {
      console.error("Sync failed", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateSettings = (newSettings: Partial<AdminSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('access_admin_settings', JSON.stringify(updated));
  };

  const loadData = async () => {
    if (!user) return;
    try {
      const [recs, emps] = await Promise.all([
        mockDb.getRecords(user.role === UserRole.ADMIN ? undefined : user.id),
        user.role === UserRole.ADMIN ? mockDb.getEmployees() : Promise.resolve([])
      ]);
      setRecords(recs);
      setEmployees(emps);
      setOfflineCount(mockDb.getOfflineCount());
    } catch (e) {
      console.error("Error loading data", e);
    }
  };

  const handleAuth = async (e?: React.FormEvent, directEmail?: string) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const emailToUse = directEmail || formData.email;

    try {
      if (isRegistering && !directEmail) {
        if (!formData.name || !formData.email) {
          setError('Por favor, rellena todos los campos.');
          setLoading(false);
          return;
        }
        const result = await mockDb.register(formData.name, emailToUse);
        if ('error' in result) setError(result.error);
        else setUser(result);
      } else {
        const loggedUser = await mockDb.login(emailToUse);
        if (loggedUser) setUser(loggedUser);
        else setError('Credenciales no válidas o usuario no encontrado.');
      }
    } catch (err) {
      setError('Error de conexión local.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (employee: User, filteredRecords: any[]) => {
    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    
    let totalMinutes = 0;
    const tableData = filteredRecords.map(g => {
      const duration = calculateDuration(g.in, g.out);
      if (g.in && g.out) {
        totalMinutes += Math.floor((new Date(g.out).getTime() - new Date(g.in).getTime()) / 60000);
      }
      return [
        new Date(g.date).toLocaleDateString('es-ES'),
        g.in ? new Date(g.in).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--',
        g.out ? new Date(g.out).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--',
        duration || 'Incompleto'
      ];
    });

    const totalHours = `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;

    doc.setFillColor(settings.primaryColor);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('ACCESO', 15, 24);
    doc.setFontSize(10);
    doc.text('REPORTE DE ASISTENCIA OFICIAL', 160, 22, { align: 'right' });

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(12);
    doc.text(`COLABORADOR: ${employee.name.toUpperCase()}`, 15, 48);
    doc.text(`EMAIL: ${employee.email}`, 15, 54);
    doc.text(`RANGO: ${startDate || 'Inicio'} hasta ${endDate || 'Hoy'}`, 15, 60);
    doc.text(`TOTAL TRABAJADO: ${totalHours}`, 15, 66);

    (doc as any).autoTable({
      startY: 75,
      head: [['FECHA', 'ENTRADA', 'SALIDA', 'TOTAL']],
      body: tableData,
      headStyles: { fillStyle: settings.primaryColor, textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      margin: { left: 15, right: 15 }
    });

    doc.save(`ACCESS_REPORT_${employee.name.toUpperCase().replace(/\s/g, '_')}.pdf`);
  };

  const calculateDuration = (inTime?: string, outTime?: string) => {
    if (!inTime || !outTime) return null;
    const diff = new Date(outTime).getTime() - new Date(inTime).getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const getFilteredGroups = (targetUserId?: string) => {
    let rawRecords = records;
    if (targetUserId) {
      rawRecords = rawRecords.filter(r => r.userId === targetUserId);
    }

    const groups: { [key: string]: any } = {};
    rawRecords.forEach(rec => {
      const dateKey = new Date(rec.timestamp).toISOString().split('T')[0];
      
      if (startDate && dateKey < startDate) return;
      if (endDate && dateKey > endDate) return;

      const groupKey = `${rec.userId}_${dateKey}`;
      if (!groups[groupKey]) groups[groupKey] = { ...rec, date: dateKey, in: null, out: null };
      if (rec.type === RecordType.IN) groups[groupKey].in = rec.timestamp;
      else groups[groupKey].out = rec.timestamp;
    });

    return Object.values(groups).sort((a: any, b: any) => b.date.localeCompare(a.date));
  };

  const dashboardRecords = useMemo(() => getFilteredGroups(user?.role === UserRole.EMPLOYEE ? user.id : undefined), [records, startDate, endDate, user]);
  const employeeDetailRecords = useMemo(() => selectedEmployee ? getFilteredGroups(selectedEmployee.id) : [], [records, selectedEmployee, startDate, endDate]);

  const summary = useMemo(() => {
    if (!user || user.role !== UserRole.ADMIN) return null;
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    const todayRecords = records.filter(r => r.timestamp.startsWith(today));
    const activeNow = new Set(todayRecords.filter(r => r.type === RecordType.IN).map(r => r.userId));
    const finishedToday = new Set(todayRecords.filter(r => r.type === RecordType.OUT).map(r => r.userId));
    
    const trulyActive = Array.from(activeNow).filter(id => !finishedToday.has(id)).length;
    
    const weeklyRecords = records.filter(r => r.timestamp >= weekAgoStr);
    const uniqueWeekly = new Set(weeklyRecords.map(r => r.userId)).size;

    return {
      activeToday: trulyActive,
      totalToday: finishedToday.size + trulyActive,
      weeklyActive: uniqueWeekly,
      totalEmployees: employees.length
    };
  }, [records, employees, user]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-gray-100 animate-in fade-in zoom-in duration-500">
          <div className="text-center mb-10">
            <div className="bg-blue-600 inline-block px-6 py-3 rounded-lg shadow-lg mb-6">
               <h1 className="text-3xl font-bold text-white">ACCESO</h1>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
            </h2>
            <p className="text-gray-500 text-sm">Sistema de Control de Accesos Empresarial</p>
          </div>

          <form onSubmit={(e) => handleAuth(e)} className="space-y-5">
            {isRegistering && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">Nombre Completo</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  required 
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-gray-800" 
                  placeholder="Juan Pérez García"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700">Correo Electrónico</label>
              <input 
                type="email" 
                value={formData.email} 
                onChange={(e) => setFormData({...formData, email: e.target.value})} 
                required 
                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-gray-800" 
                placeholder="usuario@empresa.com"
              />
            </div>
            {error && <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium">{error}</div>}
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold uppercase tracking-wide hover:bg-blue-700 transition shadow-md active:scale-95"
            >
              {loading ? 'Procesando...' : (isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión')}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <button 
              onClick={() => { setIsRegistering(!isRegistering); setError(null); }} 
              className="text-sm text-gray-600 hover:text-blue-600 transition font-medium"
            >
              {isRegistering ? '¿Ya tienes cuenta? Iniciar Sesión' : '¿No tienes cuenta? Regístrate'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">AC</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">ACCESO</h1>
              <p className="text-xs text-gray-500">Control de Accesos</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.role === UserRole.ADMIN ? 'Administrador' : 'Usuario'}</p>
            </div>
            {isSyncing && <i className="fas fa-sync-alt animate-spin text-blue-600"></i>}
            {!isOnline && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">Offline</span>}
            <button onClick={() => setUser(null)} className="text-gray-500 hover:text-red-600 transition text-lg">
              <i className="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </div>
      </header>

      {offlineCount > 0 && !isSyncing && (
        <div className="bg-amber-50 border-b border-amber-200 p-3 text-center">
          <p className="text-sm text-amber-800 font-medium flex items-center justify-center gap-2">
            <i className="fas fa-cloud-upload-alt"></i>
            {offlineCount} registros pendientes de sincronizar
            {isOnline && <button onClick={handleSync} className="ml-2 underline font-semibold">Sincronizar</button>}
          </p>
        </div>
      )}

      {user.role === UserRole.ADMIN && !selectedEmployee && (
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto flex">
            <button onClick={() => setActiveTab('history')} className={`flex-1 py-4 text-sm font-semibold uppercase tracking-wide transition-all border-b-2 ${activeTab === 'history' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>Registros</button>
            <button onClick={() => setActiveTab('employees')} className={`flex-1 py-4 text-sm font-semibold uppercase tracking-wide transition-all border-b-2 ${activeTab === 'employees' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>Usuarios</button>
            <button onClick={() => setActiveTab('settings')} className={`flex-1 py-4 text-sm font-semibold uppercase tracking-wide transition-all border-b-2 ${activeTab === 'settings' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-600 hover:text-gray-900'}`}><i className="fas fa-cog mr-2"></i>Configuración</button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {activeTab === 'settings' && user.role === UserRole.ADMIN ? (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-900">Configuración del Sistema</h2>
            
            {/* QR Generation Tool */}
            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Generador de Código QR</h3>
                <p className="text-sm text-gray-600">Crea códigos QR para los puntos de acceso</p>
              </div>
              <div className="flex flex-col items-center py-6">
                <div ref={qrContainerRef} className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300 mb-6"></div>
                <input 
                  type="text" 
                  value={qrText} 
                  onChange={(e) => setQrText(e.target.value)}
                  placeholder="Identificador del punto de acceso"
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 space-y-6">
              <h3 className="text-lg font-bold text-gray-900">Personalización</h3>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Color Principal</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="color" 
                    value={settings.primaryColor} 
                    onChange={(e) => updateSettings({ primaryColor: e.target.value })}
                    className="w-20 h-20 rounded-lg border-2 border-gray-300 cursor-pointer"
                  />
                  <div className="text-sm text-gray-600">
                    <p>Color actual: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{settings.primaryColor}</code></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : selectedEmployee && user.role === UserRole.ADMIN ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <button 
                onClick={() => { setSelectedEmployee(null); setStartDate(''); setEndDate(''); }} 
                className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-600"
              >
                <i className="fas fa-arrow-left text-lg"></i>
              </button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedEmployee.name}</h2>
                <p className="text-sm text-gray-500">Detalles de acceso del usuario</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
               <h3 className="text-lg font-bold text-gray-900">Filtro de Registros</h3>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha Inicial</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha Final</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                  </div>
               </div>
               <button 
                  onClick={() => handleDownloadPDF(selectedEmployee, employeeDetailRecords)}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition"
               >
                 <i className="fas fa-file-pdf"></i> Descargar Reporte PDF
               </button>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Registros ({employeeDetailRecords.length})</h3>
              {employeeDetailRecords.length === 0 ? (
                <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500">
                  <p>No hay registros en este período</p>
                </div>
              ) : (
                employeeDetailRecords.map((group, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                     <div className="flex justify-between items-center mb-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {new Date(group.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                          {calculateDuration(group.in, group.out) || 'En curso'}
                        </span>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                          <p className="text-xs font-semibold text-gray-600 mb-2">ENTRADA</p>
                          <p className="text-xl font-bold text-gray-900">{group.in ? new Date(group.in).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                          <p className="text-xs font-semibold text-gray-600 mb-2">SALIDA</p>
                          <p className="text-xl font-bold text-gray-900">{group.out ? new Date(group.out).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                        </div>
                     </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : activeTab === 'employees' && user.role === UserRole.ADMIN ? (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h2>
            {employees.length === 0 ? (
              <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500">
                <p>No hay usuarios registrados</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {employees.map(emp => (
                  <div 
                    key={emp.id} 
                    className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between hover:shadow-md transition"
                  >
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-lg">
                          {emp.name.charAt(0).toUpperCase()}
                       </div>
                       <div>
                          <h3 className="font-bold text-gray-900">{emp.name}</h3>
                          <p className="text-sm text-gray-500">{emp.email}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <button 
                        onClick={() => setSelectedEmployee(emp)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
                       >
                         Ver Detalles
                       </button>
                       <button 
                        onClick={() => { if(confirm(`¿Eliminar a ${emp.name}?`)) mockDb.deleteEmployee(emp.id).then(loadData); }} 
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                       >
                         <i className="fas fa-trash-alt"></i>
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Dashboard summary */}
            {user.role === UserRole.ADMIN && summary && settings.showSummary && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Activos Hoy</p>
                      <p className="text-3xl font-bold text-blue-600 mt-2">{summary.activeToday}</p>
                      <p className="text-xs text-gray-500 mt-1">de {summary.totalEmployees} usuarios</p>
                    </div>
                    <i className="fas fa-users text-4xl text-blue-100"></i>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Activos (Últimos 7 días)</p>
                      <p className="text-3xl font-bold text-green-600 mt-2">{summary.weeklyActive}</p>
                      <p className="text-xs text-gray-500 mt-1">usuarios únicos</p>
                    </div>
                    <i className="fas fa-chart-line text-4xl text-green-100"></i>
                  </div>
                </div>
              </div>
            )}

            {/* Filters */}
            {user.role === UserRole.ADMIN && (
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Filtrar Registros</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Desde</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Hasta</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                  </div>
                </div>
              </div>
            )}

            {/* Records */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {user.role === UserRole.ADMIN ? 'Historial de Accesos' : 'Mi Historial'}
              </h2>
              {dashboardRecords.length === 0 ? (
                <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500">
                  <p>No hay registros de acceso</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dashboardRecords.map((group, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition">
                      <div className="flex items-center justify-between mb-4">
                         <div>
                          <p className="text-sm font-semibold text-gray-900">{group.userName}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(group.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                         </div>
                         <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                           {calculateDuration(group.in, group.out) || 'En curso'}
                         </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="bg-gray-50 p-4 rounded-lg">
                           <p className="text-xs font-semibold text-gray-600 mb-2">ENTRADA</p>
                           <p className="text-lg font-bold text-gray-900">{group.in ? new Date(group.in).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                         </div>
                         <div className="bg-gray-50 p-4 rounded-lg">
                           <p className="text-xs font-semibold text-gray-600 mb-2">SALIDA</p>
                           <p className="text-lg font-bold text-gray-900">{group.out ? new Date(group.out).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {user.role === UserRole.EMPLOYEE && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-6 shadow-lg">
           <div className="max-w-7xl mx-auto flex justify-center">
             <button onClick={() => setShowScanner(true)} className="w-full md:w-96 bg-blue-600 text-white py-4 rounded-lg font-bold uppercase tracking-wide flex items-center justify-center gap-3 hover:bg-blue-700 transition shadow-lg">
              <i className="fas fa-qrcode text-2xl"></i>
              Registrar Acceso
             </button>
           </div>
        </div>
      )}

      {showScanner && (
        <Scanner onScan={(code) => { 
          mockDb.addRecord(user!.id, user!.name, code).then(() => {
            setShowScanner(false);
            loadData();
          });
        }} onCancel={() => setShowScanner(false)} />
      )}
    </div>
  );
};

export default App;
