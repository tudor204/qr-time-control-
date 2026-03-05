import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tudor.qrtimecontrol',
  appName: 'QR Time Control',
  webDir: 'dist',
  plugins: {
    NativeBiometric: {
      faceIdTitle: "Acceso Biométrico",
      faceIdSubtitle: "Usa tu rostro para acceder",
      faceIdDescription: "Face ID es requerido para acceder",
      biometricTitle: "Acceso Biométrico",
      biometricSubtitle: "Usa tu huella o rostro para acceder",
      biometricDescription: "Biometría es requerida para acceder"
    }
  }
};

export default config;
