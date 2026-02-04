import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface ScannerProps {
  onScan: (code: string) => void;
  onCancel: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannedRef = useRef(false);
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    // CONFIGURACIÓN DE VIDEO FLEXIBLE
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: 'environment' }, // Intenta trasera, si no, usa la que haya
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    // En lugar de undefined, usamos decodeFromConstraints para mayor compatibilidad móvil
    reader
      .decodeFromConstraints(
        constraints,
        videoRef.current!,
        (result) => {
          if (result && !scannedRef.current) {
            scannedRef.current = true;
            onScan(result.getText());
          }
        }
      )
      .then((controls) => {
        // ZXing maneja el stream internamente, pero lo guardamos para limpieza manual si fuera necesario
        // @ts-ignore - Algunas versiones de ZXing no exponen el stream directamente en controls
        if (videoRef.current?.srcObject) {
           streamRef.current = videoRef.current.srcObject as MediaStream;
        }
      })
      .catch((err) => {
        console.error("Error de cámara:", err);
        setError('No se pudo acceder a la cámara. Asegúrate de dar permisos.');
      });

    return () => {
      // Limpieza exhaustiva
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      readerRef.current = null;
      startedRef.current = false;
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[100] p-6 animate-in fade-in duration-300">
      
      <div className="absolute top-8 text-center z-20">
        <p className="text-blue-400 text-xs font-black uppercase tracking-widest mb-2">
          Escáner Universal
        </p>
        <h2 className="text-2xl font-bold text-white">Lectura QR</h2>
      </div>

      <div className="relative w-full max-w-[320px] aspect-square rounded-3xl overflow-hidden mb-12 bg-gray-900 border-2 border-white/10 shadow-2xl">
        
        {/* VIDEO REAL */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
        />

        {/* UI DE ESCANEO (Línea y esquinas) */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <div className="absolute top-6 left-6 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl"></div>
          <div className="absolute top-6 right-6 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr"></div>
          <div className="absolute bottom-6 left-6 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl"></div>
          <div className="absolute bottom-6 right-6 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br"></div>
          
          {/* Línea de escaneo animada */}
          <div className="absolute inset-x-0 h-1 bg-blue-400 shadow-[0_0_15px_rgba(96,165,250,1)] animate-scan-line"></div>
        </div>

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white p-6 text-center z-30">
            <span className="text-3xl mb-4">⚠️</span>
            <p className="text-sm font-medium text-red-400">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 text-xs text-blue-400 underline"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>

      <button
        onClick={onCancel}
        className="w-full max-w-[280px] py-4 text-white font-bold uppercase tracking-widest text-xs bg-white/10 hover:bg-white/20 rounded-2xl border border-white/10 transition-transform active:scale-95"
      >
        Cerrar Escáner
      </button>

      <style>{`
        @keyframes scan-line {
          0% { top: 10%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
        .animate-scan-line {
          position: absolute;
          animation: scan-line 3s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Scanner;