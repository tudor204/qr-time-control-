import React, { useState } from 'react';
import { AttendanceRecord } from '../../types';

interface CorrectAttendanceModalProps {
    employee: { id: string; name: string };
    openShift: AttendanceRecord | null;
    onSave: (correction: { timestamp: string; notes: string }) => Promise<void>;
    onClose: () => void;
}

export const CorrectAttendanceModal: React.FC<CorrectAttendanceModalProps> = ({
    employee,
    openShift,
    onSave,
    onClose
}) => {
    const [time, setTime] = useState('');
    const [reason, setReason] = useState('No especificado');
    const [loading, setLoading] = useState(false);

    if (!openShift) return null;

    const entryTime = new Date(openShift.timestamp);
    const dateStr = entryTime.toISOString().split('T')[0];

    const handleSave = async () => {
        if (!time) {
            alert('Por favor, introduce una hora de salida');
            return;
        }

        setLoading(true);
        try {
            const timestamp = `${dateStr}T${time}:00`;
            await onSave({ timestamp, notes: reason });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 no-print">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose}></div>
            <div className="bg-slate-50 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[3.5rem] shadow-[0_30px_90px_rgba(0,0,0,0.3)] relative z-10 overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[92vh] animate-modal-in">
                {/* Header */}
                <div className="p-6 sm:p-8 bg-white border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">Cerrar Salida</h3>
                        <p className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] mt-0.5 sm:mt-1">{employee.name}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl sm:rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-red-500 transition-all shrink-0"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 sm:p-8 overflow-y-auto bg-slate-50 space-y-6 custom-scrollbar flex-1">
                    {/* Info del turno */}
                    <div className="bg-orange-50 p-4 rounded-2xl border border-orange-200">
                        <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2">📌 Turno Abierto</p>
                        <p className="text-sm font-bold text-slate-700">
                            Entrada: {new Date(openShift.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            Horas abiertas: {((Date.now() - new Date(openShift.timestamp).getTime()) / 3600000).toFixed(1)}h
                        </p>
                    </div>

                    {/* Hora de salida */}
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">
                            ⏰ Hora de Salida
                        </label>
                        <input
                            type="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-lg text-slate-900 outline-none focus:bg-white focus:border-blue-600/20 transition-all"
                        />
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-3">
                            Fecha: {new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                    </div>

                    {/* Motivo */}
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">
                            📝 Motivo / Justificación
                        </label>
                        <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-600/20 transition-all appearance-none cursor-pointer"
                        >
                            <option>Olvido del empleado</option>
                            <option>Corrección manual</option>
                            <option>Cierre automático (12h+)</option>
                            <option>No especificado</option>
                            <option>Otro motivo</option>
                        </select>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 sm:p-8 bg-white border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
                    <button
                        onClick={onClose}
                        className="w-full sm:flex-1 px-4 sm:px-6 py-3.5 sm:py-3 bg-slate-100 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading || !time}
                        className="w-full sm:flex-1 px-4 sm:px-6 py-3.5 sm:py-3 bg-green-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-green-700 disabled:bg-gray-400 transition-all shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <i className="fas fa-spinner animate-spin"></i>
                                Guardando...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-check"></i>
                                Cerrar Salida
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
