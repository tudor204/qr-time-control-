import React, { useEffect, useState } from 'react';
// Usamos esta librería moderna y ligera para el escaneo
import { Scanner as QrScanner, IDetectedBarcode } from '@yudiel/react-qr-scanner';

interface ScannerProps {
  onScan: (code: string) => void;
  onCancel: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onCancel }) => {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean>(true);

  useEffect(() => {
    // Pequeño delay para la animación de entrada
    const timer = setTimeout(() => setActive(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleScan = (detectedCodes: IDetectedBarcode[]) => {
    if (detectedCodes && detectedCodes.length > 0) {
      // Evitar lecturas múltiples muy rápidas si es necesario
      onScan(detectedCodes[0].rawValue);
    }
  };

  const handleError = (err: any) => {
    console.error(err);
    setError("No se pudo acceder a la cámara.");
    setCameraPermission(false);
  };

  return (
    <div className={`fixed inset-0 bg-black flex flex-col items-center justify-center z-50 p-6 transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`}>
      
      {/* Header */}
      <div className="absolute top-8 left-0 right-0 text-center z-20">
        <p className="text-blue-400 text-sm font-semibold uppercase tracking-wide mb-2">Escáner de Acceso</p>
        <h2 className="text-2xl font-bold text-white">Lectura de Código QR</h2>
      </div>

      {/* Zona del Escáner */}
      <div className="relative w-full max-w-[280px] aspect-square rounded-lg overflow-hidden mb-12 bg-black">
        
        {/* Bordes decorativos (UI original) */}
        <div className="absolute top-0 left-0 w-full h-full border-2 border-blue-400/30 rounded-lg z-10 pointer-events-none"></div>
        <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-blue-400 rounded-tl z-20"></div>
        <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-blue-400 rounded-tr z-20"></div>
        <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-blue-400 rounded-bl z-20"></div>
        <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-blue-400 rounded-br z-20"></div>

        {/* Línea de escaneo animada */}
        <div className="absolute inset-x-0 h-0.5 bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)] animate-[scan_2s_infinite] z-20"></div>

        {/* Componente Real de Cámara */}
        {cameraPermission ? (
          <div className="w-full h-full object-cover">
            <QrScanner
              onScan={handleScan}
              onError={handleError}
              // constraints={{ facingMode: 'environment' }} // Usa la cámara trasera por defecto
              styles={{ container: { width: '100%', height: '100%' } }}
              components={{
                 audio: false, // Desactiva sonido si no se requiere
                 onOff: false, // Oculta botón de encendido por defecto de la lib
                 tracker: false // Oculta el cuadro verde por defecto de la lib
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-white p-4 text-center">
            <i className="fas fa-exclamation-triangle text-3xl text-yellow-500 mb-2"></i>
            <p className="text-sm">{error || "Permiso denegado"}</p>
          </div>
        )}
      </div>
      
      {/* Instrucciones */}
      <p className="text-center text-gray-300 text-sm font-semibold mb-10 max-w-xs z-20">
        Apunta el código QR al escáner para registrar tu acceso
      </p>
      
      {/* Botones */}
      <div className="flex flex-col gap-4 w-full max-w-sm z-20">
        <button 
          onClick={onCancel}
          className="w-full py-3 text-gray-300 font-semibold uppercase tracking-wide text-sm hover:text-white transition bg-white/10 rounded-lg backdrop-blur-md border border-white/10"
        >
          Cancelar / Cerrar
        </button>
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { top: 10%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          50% { top: 90%; }
        }
      `}</style>
    </div>
  );
};

export default Scanner;