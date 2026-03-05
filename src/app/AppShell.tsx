import React, { useEffect } from 'react';
import { UserRole, RecordType } from '../types';
import { dbService } from '../services/dbService';
import Scanner from '../components/Scanner';
import { AdminDashboard } from '../components/Admin/AdminDashboard';
import { EmployeeDashboard } from '../components/Employee/EmployeeDashboard';
import { EmployeeProfileModal } from '../components/Admin/EmployeeProfileModal';
import { AbsenceModal } from '../components/Admin/AbsenceModal';
import { CompanyModal } from '../components/Admin/CompanyModal';
import { useFeedback } from './useFeedback';
import { useAuthController } from './useAuthController';
import { useAppState } from './useAppState';
import { useModals } from './useModals';
import { useRoleView } from './useRoleView';
import { LoginForm } from '../components/Auth/LoginForm';

export const AppShell: React.FC = () => {
  const { feedback, showFeedback } = useFeedback();
  const {
    user,
    loading,
    isRegistering,
    setIsRegistering,
    formData,
    setFormData,
    handleAuth,
    handleBiometricAuth,
    logout,
    biometricEnabled
  } = useAuthController(showFeedback);

  const {
    records,
    employees,
    setEmployees,
    absences,
    companies,
    setCompanies,
    loadData
  } = useAppState();

  const {
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
    companyFormData,
    setCompanyFormData,
    openNewCompanyModal,
    openEditCompanyModal,
    showAbsenceModal,
    setShowAbsenceModal,
    absenceFormData,
    setAbsenceFormData
  } = useModals();

  const {
    activeTab,
    setActiveTab,
    employeeTab,
    setEmployeeTab,
    selectedCompanyId,
    setSelectedCompanyId,
    qrText,
    getDayStatusText
  } = useRoleView(user, records, absences);

  // Estado para mostrar/ocultar empleados eliminados
  const [, setShowDeletedEmployees] = React.useState(false);

  useEffect(() => {
    if (user) {
      loadData(user);
    }
  }, [user, loadData]);

  // --- Handlers ---
  const handleQrScan = async (code: string) => {
    if (!user || code.trim() !== qrText.trim()) {
      showFeedback('QR no válido', 'error');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const absence = absences.find(a => a.userId === user.id && a.date === today);
    if (absence) {
      showFeedback('Día marcado como AUSENTE. No puedes fichar hoy.', 'error');
      return;
    }

    const userToday = records.filter(r => r.userId === user.id && r.timestamp.startsWith(today));
    if (userToday.length >= 2) {
      showFeedback('Ya has completado tu jornada de hoy', 'error');
      setTimeout(() => setShowScanner(false), 2000);
      return;
    }

    const nextType = userToday.length === 0 ? RecordType.IN : RecordType.OUT;

    try {
      await dbService.addRecord(user.id, user.name, code, nextType);
      showFeedback(nextType === RecordType.IN ? '¡Entrada registrada!' : '¡Salida registrada!');
      setTimeout(() => {
        setShowScanner(false);
        loadData(user);
      }, 1500);
    } catch (e) {
      showFeedback('Error al fichar', 'error');
    }
  };

  const handleSaveAbsence = async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const userToday = records.filter(r => r.userId === user.id && r.timestamp.startsWith(today));
    if (userToday.length > 0) {
      showFeedback('No puedes marcar ausencia si ya has fichado hoy', 'error');
      return;
    }

    try {
      await dbService.addAbsence({
        userId: user.id,
        date: absenceFormData.date,
        predefinedReason: absenceFormData.predefinedReason,
        customReason: absenceFormData.predefinedReason === 'Otro' ? absenceFormData.customReason : undefined
      });
      showFeedback('Ausencia registrada correctamente');
      setShowAbsenceModal(false);
      loadData(user);
    } catch (e) {
      showFeedback('Error al registrar ausencia', 'error');
    }
  };

  // --- Render ---
  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-blue-600 animate-pulse uppercase">Cargando sistema...</div>;

  if (!user) {
    return (
      <LoginForm
        isRegistering={isRegistering}
        formData={formData}
        onSubmit={handleAuth}
        onChange={(field, value) => setFormData({ ...formData, [field]: value })}
        onToggleRegister={() => setIsRegistering(!isRegistering)}
        onBiometricAuth={handleBiometricAuth}
        hasBiometric={biometricEnabled}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-32 font-inter selection:bg-blue-100 selection:text-blue-700">
      {/* Header */}
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
          <button onClick={logout} className="group flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all font-bold text-xs interactive-button">
            <span className="hidden sm:block">Cerrar Sesión</span>
            <i className="fas fa-power-off transition-transform group-hover:rotate-12"></i>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-5xl mx-auto">
        {user.role === UserRole.ADMIN ? (
          <AdminDashboard
            user={user}
            records={records}
            employees={employees}
            absences={absences}
            companies={companies}
            activeTab={activeTab}
            selectedCompanyId={selectedCompanyId}
            qrText={qrText}
            showFeedback={showFeedback}
            setActiveTab={setActiveTab}
            setSelectedCompanyId={setSelectedCompanyId}
            setSelectedEmployee={setSelectedEmployee}
            setCompanies={setCompanies}
            openNewCompanyModal={openNewCompanyModal}
            openEditCompanyModal={openEditCompanyModal}
            loadData={loadData}
            onShowDeletedEmployeesChange={setShowDeletedEmployees}
          />
        ) : (
          <EmployeeDashboard
            user={user}
            records={records}
            absences={absences}
            employeeTab={employeeTab}
            getDayStatusText={getDayStatusText}
            setEmployeeTab={setEmployeeTab}
            setShowScanner={setShowScanner}
            setShowAbsenceModal={setShowAbsenceModal}
          />
        )}
      </main>

      {/* Modals */}
      {selectedEmployee && user.role === UserRole.ADMIN && (
        <EmployeeProfileModal
          employee={selectedEmployee}
          records={records}
          absences={absences}
          employees={employees}
          companies={companies}
          vacationDate={vacationDate}
          editingVacationId={editingVacationId}
          showFeedback={showFeedback}
          setEmployees={setEmployees}
          setSelectedEmployee={setSelectedEmployee}
          setVacationDate={setVacationDate}
          setEditingVacationId={setEditingVacationId}
          setShowDeletedEmployees={setShowDeletedEmployees}
          onReactivateSuccess={() => loadData(user)}
          onClose={closeEmployeeModal}
        />
      )}

      {showAbsenceModal && (
        <AbsenceModal
          absenceFormData={absenceFormData}
          setAbsenceFormData={setAbsenceFormData}
          onSave={handleSaveAbsence}
          onClose={() => setShowAbsenceModal(false)}
        />
      )}

      {showCompanyModal && (
        <CompanyModal
          isEditing={isEditingCompany}
          companyFormData={companyFormData}
          companies={companies}
          showFeedback={showFeedback}
          setCompanyFormData={setCompanyFormData}
          setCompanies={setCompanies}
          onClose={() => setShowCompanyModal(false)}
        />
      )}

      {showScanner && (
        <Scanner onScan={handleQrScan} onCancel={() => setShowScanner(false)} />
      )}

      {/* Feedback Toast */}
      {feedback && (
        <div className={`fixed bottom-24 md:bottom-32 left-1/2 -translate-x-1/2 z-[200] ${feedback.type === 'success' ? 'bg-slate-900' : 'bg-red-600'} text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300`}>
          <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-widest">{feedback.msg}</span>
        </div>
      )}
    </div>
  );
};
