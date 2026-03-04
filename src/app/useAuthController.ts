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

export const useAuthController = (showFeedback: (msg: string, type?: 'success' | 'error') => void) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRegistering, setIsRegistering] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });

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
            showFeedback('Sesión cerrada correctamente', 'success');
        } catch (error) {
            showFeedback('Error al cerrar sesión', 'error');
        }
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
        logout
    };
};
