import { db } from './firebaseConfig';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  deleteDoc,
  collectionGroup,
  writeBatch
} from 'firebase/firestore';
import { auth } from './firebaseConfig';
import { deleteUser } from 'firebase/auth';
import { User, AttendanceRecord, RecordType, Absence } from '../types';

export const dbService = {
  // Guardar perfil de usuario
  async saveUserProfile(user: User) {
    await setDoc(doc(db, 'users', user.id), user);
  },

  // Obtener perfil de usuario
  async getUserProfile(uid: string): Promise<User | null> {
    const docSnap = await getDoc(doc(db, 'users', uid));
    return docSnap.exists() ? (docSnap.data() as User) : null;
  },

  // OBTENER TODOS LOS EMPLEADOS (Para el Admin) - Excluimos eliminados
  // Nota: Filtramos en JS porque Firestore '!=' excluye documentos donde el campo no existe.
  async getEmployees(): Promise<User[]> {
    const querySnapshot = await getDocs(collection(db, 'users'));
    return querySnapshot.docs
      .map(doc => doc.data() as User)
      .filter(user => user.isDeleted !== true);
  },

  // AGREGAR REGISTRO DE ASISTENCIA (Jerárquico)
  async addRecord(userId: string, userName: string, location: string, type: RecordType) {
    try {
      const newRecord = {
        userId,
        userName,
        location,
        timestamp: new Date().toISOString(),
        type
      };
      // users/{userId}/attendance/{recordId}
      return await addDoc(collection(db, 'users', userId, 'attendance'), newRecord);
    } catch (error) {
      console.error("Error en addRecord:", error);
      throw error;
    }
  },

  // OBTENER REGISTROS (Jerárquico)
  async getRecords(userId?: string): Promise<AttendanceRecord[]> {
    try {
      let q;
      if (userId) {
        // Consulta para empleado específico en su subcolección
        const recordsRef = collection(db, 'users', userId, 'attendance');
        q = query(recordsRef, orderBy('timestamp', 'desc'));
      } else {
        // Consulta para admin (todos los registros usando collectionGroup)
        q = query(collectionGroup(db, 'attendance'), orderBy('timestamp', 'desc'));
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        ...(doc.data() as any),
        id: doc.id
      } as AttendanceRecord));
    } catch (error) {
      console.error("Error obteniendo registros:", error);
      return [];
    }
  },

  // ELIMINACIÓN FÍSICA (Hard Delete) - Solicidatado por el usuario
  async deleteUserCompletely(userId: string) {
    try {
      const batch = writeBatch(db);

      // 1. Obtener y eliminar registros de asistencia
      const recordsSnapshot = await getDocs(collection(db, 'users', userId, 'attendance'));
      recordsSnapshot.forEach((doc) => batch.delete(doc.ref));

      // 2. Obtener y eliminar registros de ausencias
      const absencesSnapshot = await getDocs(collection(db, 'users', userId, 'absences'));
      absencesSnapshot.forEach((doc) => batch.delete(doc.ref));

      // 3. Eliminar el documento del usuario
      batch.delete(doc(db, 'users', userId));

      // 4. Ejecutar el batch en Firestore
      await batch.commit();

      // 5. Eliminar de Firebase Authentication
      // Nota: Esto requiere que el usuario esté autenticado recientemente.
      // Si falla, el usuario de Firestore ya no existe, pero el de Auth sí.
      // En un entorno de producción real, esto se haría mejor con Firebase Admin SDK en una Cloud Function.
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.uid === userId) {
        await deleteUser(currentUser);
      } else {
        console.warn("No se puede eliminar de Auth directamente: El usuario no es el actual o la sesión expiró.");
        // Opcional: Podríamos lanzar un error indicando que se requiere re-autenticación
      }
    } catch (error) {
      console.error("Error en deleteUserCompletely:", error);
      throw error;
    }
  },

  // ELIMINACIÓN LÓGICA (Soft Delete) - Recomendado para cumplimiento legal
  async softDeleteUser(userId: string) {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        isDeleted: true,
        deletedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error("Error en softDeleteUser:", error);
      throw error;
    }
  },

  // GESTIONAR AUSENCIAS (Jerárquico)
  async addAbsence(absence: Omit<Absence, 'id' | 'createdAt'>) {
    try {
      const data: any = {
        ...absence,
        createdAt: new Date().toISOString()
      };

      Object.keys(data).forEach(key =>
        data[key] === undefined && delete data[key]
      );

      // users/{userId}/absences/{absenceId}
      return await addDoc(collection(db, 'users', absence.userId, 'absences'), data);
    } catch (error) {
      console.error("Error en addAbsence:", error);
      throw error;
    }
  },

  async getAbsences(userId?: string): Promise<Absence[]> {
    try {
      let q;
      if (userId) {
        const absenceRef = collection(db, 'users', userId, 'absences');
        q = query(absenceRef, orderBy('date', 'desc'));
      } else {
        q = query(collectionGroup(db, 'absences'), orderBy('date', 'desc'));
      }
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        ...(doc.data() as any),
        id: doc.id
      } as Absence));
    } catch (error) {
      console.error("Error obteniendo ausencias:", error);
      return [];
    }
  },

  async deleteAbsence(userId: string, absenceId: string) {
    try {
      await deleteDoc(doc(db, 'users', userId, 'absences', absenceId));
    } catch (error) {
      console.error("Error eliminando ausencia:", error);
      throw error;
    }
  }

};
