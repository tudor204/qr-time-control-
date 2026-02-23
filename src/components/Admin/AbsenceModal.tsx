import React from 'react';


interface AbsenceModalProps {
    absenceFormData: {
        date: string;
        predefinedReason: string;
        customReason: string;
    };
    setAbsenceFormData: (data: { date: string; predefinedReason: string; customReason: string }) => void;
    onSave: () => void;
    onClose: () => void;
}

export const AbsenceModal: React.FC<AbsenceModalProps> = ({
    absenceFormData,
    setAbsenceFormData,
    onSave,
    onClose
}) => {
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 no-print">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose}></div>
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative z-10 p-8 md:p-10 animate-modal-in">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center text-xl">
                        <i className="fas fa-calendar-times"></i>
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Reportar Ausencia</h3>
                        <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mt-1">Registro de inasistencia</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Fecha de Ausencia</label>
                        <input
                            type="date"
                            value={absenceFormData.date}
                            onChange={e => setAbsenceFormData({ ...absenceFormData, date: e.target.value })}
                            className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-black text-slate-700 outline-none focus:bg-white focus:border-red-600/20 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Motivo de la Ausencia</label>
                        <select
                            value={absenceFormData.predefinedReason}
                            onChange={e => setAbsenceFormData({ ...absenceFormData, predefinedReason: e.target.value })}
                            className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-black text-slate-700 outline-none focus:bg-white focus:border-red-600/20 transition-all appearance-none cursor-pointer"
                        >
                            <option value="Baja médica">Baja médica</option>
                            <option value="Asuntos propios">Asuntos propios</option>
                            <option value="Vacaciones">Vacaciones</option>
                            <option value="Formación">Formación</option>
                            <option value="Otro">Otro motivo...</option>
                        </select>
                    </div>

                    {absenceFormData.predefinedReason === 'Otro' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Especificar Motivo</label>
                            <textarea
                                value={absenceFormData.customReason}
                                onChange={e => setAbsenceFormData({ ...absenceFormData, customReason: e.target.value })}
                                className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-black text-slate-700 outline-none focus:bg-white focus:border-red-600/20 transition-all min-h-[100px]"
                                placeholder="Describe brevemente el motivo..."
                            />
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={onClose}
                            className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={onSave}
                            className="flex-2 bg-slate-900 text-white py-4 px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95"
                        >
                            Confirmar Ausencia
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
