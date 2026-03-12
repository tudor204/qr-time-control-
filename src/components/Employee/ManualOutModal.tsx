import React, { useState } from 'react';

interface ManualOutModalProps {
  inRecordTime: string;
  onConfirm: (outTime: string) => void;
  onCancel: () => void;
}

export const ManualOutModal: React.FC<ManualOutModalProps> = ({ inRecordTime, onConfirm, onCancel }) => {
  const [time, setTime] = useState<string>('17:00');
  const [error, setError] = useState<string | null>(null);
  
  const inDate = new Date(inRecordTime);
  const formattedIn = isNaN(inDate.getTime()) ? '--:--' : inDate.toLocaleTimeString(['es-ES'], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] p-6 sm:p-8 w-full max-w-sm shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="absolute top-0 left-0 w-full h-2 bg-yellow-400"></div>
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-yellow-50 text-yellow-500 rounded-full flex items-center justify-center text-3xl shadow-sm">
            ⚠
          </div>
        </div>

        <h3 className="text-xl font-black text-center text-slate-800 tracking-tight mb-2">
          Turno incompleto detectado
        </h3>
        
        <p className="text-sm text-center text-slate-500 mb-6 font-medium">
          No registraste tu salida ayer. Puedes añadirla ahora.
        </p>

        <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Entrada detectada:</span>
          <span className="text-lg font-black text-slate-700">{formattedIn}</span>
        </div>

        <div className="mb-8">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-2">
            Hora de salida
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              setError(null);
            }}
            className={`w-full text-center text-2xl font-black text-slate-700 bg-white border-2 ${error ? 'border-red-500' : 'border-slate-200'} rounded-2xl py-4 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all`}
            required
          />
          {error && <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-2 text-center animate-pulse">{error}</p>}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              const inDate = new Date(inRecordTime);
              // Crear fecha de salida combinando el día del IN con el valor del input TIME
              const [hours, minutes] = time.split(':');
              const outDate = new Date(inDate);
              outDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

              if (outDate <= inDate) {
                setError(`La salida debe ser posterior a las ${formattedIn}`);
                return;
              }
              onConfirm(time);
            }}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 active:scale-95 interactive-button"
          >
            Confirmar salida
          </button>
          
          <button
            onClick={onCancel}
            className="w-full py-4 bg-transparent text-slate-400 hover:text-slate-600 rounded-2xl font-bold text-xs uppercase tracking-widest transition-colors active:scale-95"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
