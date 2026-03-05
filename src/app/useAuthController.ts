import React, { useState, useEffect } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    User as FirebaseUser
} from "firebase/auth";
import { auth } from '../services/firebaseConfig';
import { dbService } from '../services/dbService';
import { User, UserRole } from '../types';
import { biometricService } from '../services/biometricService';

export const useAuthController = (showFeedback: (msg: string, type?: 'success' | 'error') => void) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRegistering, setIsRegistering] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [biometricEnabled, setBiometricEnabled] = useState(() => localStorage.getItem('biometric_enabled') === 'true');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
            if (firebaseUser) {
                try {
                    const idTokenResult = await firebaseUser.getIdTokenResult();
                    const roleFromClaim = idTokenResult.claims.role as UserRole | undefined;

                    const profile = await dbService.getUserProfile(firebaseUser.uid);
                    if (profile) {
                        const updatedUser = {
                            ...profile,
                            role: roleFromClaim || profile.role
                        };
                        setUser(updatedUser);
                    }
                } catch (error) {
                    console.error("Error al cargar perfil tras cambio de auth:", error);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isRegistering) {
                const creds = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
                const newUser: User = {
                    id: creds.user.uid,
                    name: formData.name,
                    email: formData.email,
                    role: UserRole.EMPLOYEE,
                    weeklyHours: 40,
                    vacations: []
                };
                await dbService.saveUserProfile(newUser.id, newUser);
                setUser(newUser);
                showFeedback('Cuenta creada correctamente');
            } else {
                const creds = await signInWithEmailAndPassword(auth, formData.email, formData.password);

                try {
                    const isBiometricAvailable = await biometricService.isAvailable();
                    if (isBiometricAvailable) {
                        await biometricService.saveCredentials(formData.email, formData.password);
                        localStorage.setItem('biometric_enabled', 'true');
                        setBiometricEnabled(true);
                        console.log("Biometría habilitada y flag guardado");
                    }
                } catch (e) {
                    console.error("Error guardando credenciales para biometría", e);
                    // No habilitar si falla
                }

                const profile = await dbService.getUserProfile(creds.user.uid);
                if (profile) {
                    setUser(profile);
                    showFeedback(`Bienvenido, ${profile.name}`);
                }
            }
        } catch (err: any) {
            showFeedback('Error de acceso: Credenciales no válidas', 'error');
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            // No borramos las credenciales biométricas para que el usuario pueda volver a entrar
            showFeedback('Sesión cerrada correctamente', 'success');
        } catch (error) {
            showFeedback('Error al cerrar sesión', 'error');
        }
    };

    const handleBiometricAuth = async () => {
        setLoading(true);
        try {
            const hasBiometric = await biometricService.isAvailable();
            if (!hasBiometric) {
                showFeedback('Biometría no disponible en este dispositivo', 'error');
                setLoading(false);
                return false;
            }

            const creds = await biometricService.getCredentials();
            if (creds && creds.username && creds.password) {
                const firebaseCreds = await signInWithEmailAndPassword(auth, creds.username, creds.password);
                const profile = await dbService.getUserProfile(firebaseCreds.user.uid);
                if (profile) {
                    setUser(profile);
                    showFeedback(`Bienvenido, ${profile.name}`);
                    return true;
                }
            } else {
                showFeedback('No hay credenciales guardadas. Inicia sesión normalmente.', 'error');
                // Deshabilitar biometría si no hay credenciales
                localStorage.removeItem('biometric_enabled');
                setBiometricEnabled(false);
            }
        } catch (err: any) {
            console.error("Error en auth biométrica:", err);
            // El usuario pudo cancelar el prompt, o falló la biometría
            showFeedback('Biometría cancelada o fallida', 'error');
        } finally {
            setLoading(false);
        }
        return false;
    };

    return {
        user,
        setUser,
        loading,
        isRegistering,
        setIsRegistering,
        formData,
        setFormData,
        handleAuth,
        handleBiometricAuth,
        logout,
        biometricEnabled
    };
};
