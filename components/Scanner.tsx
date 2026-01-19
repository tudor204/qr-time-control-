
import React, { useEffect, useState } from 'react';

interface ScannerProps {
  onScan: (code: string) => void;
  onCancel: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onCancel }) => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setActive(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSimulatedScan = () => {
    onScan("ACCESS_POINT_001");
  };

  return (
    <div className={`fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-6 transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute top-8 left-0 right-0 text-center">
        <p className="text-blue-400 text-sm font-semibold uppercase tracking-wide mb-2">Escáner de Acceso</p>
        <h2 className="text-2xl font-bold text-white">Lectura de Código QR</h2>
      </div>

      <div className="relative w-full max-w-[280px] aspect-square border-2 border-blue-400 rounded-lg overflow-hidden mb-12">
        <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-blue-400 rounded-tl"></div>
        <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-blue-400 rounded-tr"></div>
        <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-blue-400 rounded-bl"></div>
        <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-blue-400 rounded-br"></div>

        <div className="absolute inset-x-0 h-0.5 bg-blue-400 shadow-lg animate-[scan_2s_infinite] z-10"></div>
        
        <div className="flex items-center justify-center h-full bg-black/40 backdrop-blur-sm">
           <i className="fas fa-qrcode text-6xl opacity-20 text-blue-400"></i>
        </div>
      </div>
      
      <p className="text-center text-gray-300 text-sm font-semibold mb-10 max-w-xs">
        Apunta el código QR al escáner para registrar tu acceso
      </p>
      
      <div className="flex flex-col gap-4 w-full max-w-sm">
        <button 
          onClick={handleSimulatedScan}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold uppercase tracking-wide shadow-lg hover:bg-blue-700 transition active:scale-95"
        >
          Simular Lectura
        </button>
        <button 
          onClick={onCancel}
          className="w-full py-3 text-gray-300 font-semibold uppercase tracking-wide text-sm hover:text-white transition"
        >
          Cerrar Escáner
        </button>
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { top: 10%; }
          50% { top: 90%; }
        }
      `}</style>
    </div>
  );
};

export default Scanner;
