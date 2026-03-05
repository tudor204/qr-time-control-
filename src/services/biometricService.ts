import { NativeBiometric } from 'capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

export interface BiometricCredentials {
    username?: string;
    password?: string;
}

const SERVER_KEY = "qr-time-control-pro-auth";

class BiometricService {
    /**
     * Comprueba si la biometría está disponible en el dispositivo
     */
    async isAvailable(): Promise<boolean> {
        if (!Capacitor.isNativePlatform()) {
            return false;
        }

        try {
            const result = await NativeBiometric.isAvailable();
            return result.isAvailable;
        } catch (error) {
            console.error('Error comprobando disponibilidad de biometría:', error);
            return false;
        }
    }

    /**
     * Guarda las credenciales de forma segura
     */
    async saveCredentials(email: string, password: string): Promise<boolean> {
        if (!Capacitor.isNativePlatform()) {
            return false;
        }

        try {
            await NativeBiometric.setCredentials({
                username: email,
                password: password,
                server: SERVER_KEY,
            });
            return true;
        } catch (error) {
            console.error('Error guardando credenciales biométricas:', error);
            return false;
        }
    }

    /**
     * Obtiene las credenciales y solicita la biometría al usuario
     */
    async getCredentials(): Promise<BiometricCredentials | null> {
        if (!Capacitor.isNativePlatform()) {
            console.log('No es plataforma nativa, no se pueden obtener credenciales');
            return null;
        }

        try {
            console.log('Llamando a NativeBiometric.getCredentials...');
            // Esto lanza automáticamente el prompt biométrico del sistema
            const credentials = await NativeBiometric.getCredentials({
                server: SERVER_KEY,
            });

            console.log('Credenciales obtenidas con éxito');
            return credentials;
        } catch (error: any) {
            console.error('Error detallado al obtener credenciales biométricas:', error);
            // El error puede ser por cancelación del usuario o fallo de hardware
            return null;
        }
    }

    /**
     * Elimina las credenciales guardadas (p. ej. al cerrar sesión)
     */
    async deleteCredentials(): Promise<boolean> {
        if (!Capacitor.isNativePlatform()) {
            return false;
        }

        try {
            await NativeBiometric.deleteCredentials({
                server: SERVER_KEY,
            });
            console.log('Credenciales biométricas eliminadas');
            return true;
        } catch (error) {
            console.error('Error eliminando credenciales biométricas:', error);
            return false;
        }
    }
}

export const biometricService = new BiometricService();
