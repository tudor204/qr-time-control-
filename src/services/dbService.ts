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
  writeBatch,
  serverTimestamp,
  deleteField
} from 'firebase/firestore';
import { auth } from './firebaseConfig';
import { deleteUser } from 'firebase/auth';
import { User, AttendanceRecord, RecordType, Absence, Company } from '../types';

export const dbService = {
    // Obtener perfil de usuario
    async getUserProfile(uid: string): Promise<User | null> {
      const docSnap = await getDoc(doc(db, 'users', uid));
      return docSnap.exists() ? (docSnap.data() as User) : null;
    },
  // REACTIVAR USUARIO (Quitar soft delete)
  async reactivateUser(userId: string) {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        isDeleted: false,
        deletedAt: deleteField()
      }, { merge: true });
      // Auditoría
      console.info(`[AUDITORÍA] Usuario reactivado: ${userId}`);
    } catch (error) {
      console.error("Error en reactivateUser:", error);
      throw error;
    }
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

  /**
   * Actualiza un registro de asistencia existente. Útil para correcciones o
   * cierres automáticos.
   * @param userId UID del empleado propietario del registro
   * @param recordId ID del documento de attendance
   * @param data campos parciales de AttendanceRecord a modificar
   */
  async updateAttendanceRecord(userId: string, recordId: string, data: Partial<AttendanceRecord>) {
    try {
      const recRef = doc(db, 'users', userId, 'attendance', recordId);
      // eliminamos campos undefined antes de enviar
      const payload: any = { ...data };
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
      await setDoc(recRef, payload, { merge: true });
    } catch (error) {
      console.error('Error en updateAttendanceRecord:', error);
      throw error;
    }
  },

  /**
   * Corrección administrativa: crea un registro OUT retrospectivo para cerrar un turno abierto.
   * Marca el nuevo registro con status='USER_CORRECTED' y auditoría.
   */
  async correctMissingOut(
    userId: string,
    userName: string,
    correctionDate: string,  // YYYY-MM-DD
    outTime: string,          // HH:mm
    reason: string,
    adminId: string
  ) {
    try {
      const timestamp = `${correctionDate}T${outTime}:00`;
      const newOutRecord = {
        userId,
        userName,
        timestamp,
        type: RecordType.OUT,
        location: 'admin-correction',
        status: 'USER_CORRECTED',
        correctedBy: adminId,
        correctedAt: new Date().toISOString(),
        notes: reason
      };
      return await addDoc(collection(db, 'users', userId, 'attendance'), newOutRecord);
    } catch (error) {
      console.error('Error en correctMissingOut:', error);
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
      // 0. Verificar que NO sea ADMIN
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) throw new Error('Usuario no encontrado');
      const userData = userDoc.data() as User;
      if (userData.role === 'ADMIN') {
        console.warn(`[AUDITORÍA] Intento de hard delete sobre ADMIN (${userId}) bloqueado.`);
        throw new Error('No se puede eliminar un usuario ADMIN');
      }

      const batch = writeBatch(db);

      // 1. Obtener y eliminar registros de asistencia
      const recordsSnapshot = await getDocs(collection(db, 'users', userId, 'attendance'));
      recordsSnapshot.forEach((doc) => batch.delete(doc.ref));

      // 2. Obtener y eliminar registros de ausencias
      const absencesSnapshot = await getDocs(collection(db, 'users', userId, 'absences'));
      absencesSnapshot.forEach((doc) => batch.delete(doc.ref));

      // ADVERTENCIA: Si se agregan nuevas subcolecciones bajo users/{userId}, deben eliminarse aquí manualmente.

      // 3. Eliminar el documento del usuario
      batch.delete(doc(db, 'users', userId));

      // 4. Ejecutar el batch en Firestore
      await batch.commit();

      // 5. Auditoría
      console.info(`[AUDITORÍA] Hard delete ejecutado para usuario ${userId} (${userData.name}, ${userData.email})`);

      // 6. Eliminar de Firebase Authentication
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
      // 0. Verificar que NO sea ADMIN
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) throw new Error('Usuario no encontrado');
      const userData = userDoc.data() as User;
      if (userData.role === 'ADMIN') {
        console.warn(`[AUDITORÍA] Intento de soft delete sobre ADMIN (${userId}) bloqueado.`);
        throw new Error('No se puede eliminar un usuario ADMIN');
      }
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        isDeleted: true,
        deletedAt: serverTimestamp()
      }, { merge: true });
      // Auditoría
      console.info(`[AUDITORÍA] Soft delete ejecutado para usuario ${userId} (${userData.name}, ${userData.email})`);
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
  },

  // GESTIÓN DE EMPRESAS
  async getCompanies(): Promise<Company[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'companies'));
      return querySnapshot.docs.map(doc => ({
        ...doc.data() as Company,
        id: doc.id
      }));
    } catch (error) {
      console.error("Error obteniendo empresas:", error);
      return [];
    }
  },

  async saveCompany(company: Company) {
    try {
      await setDoc(doc(db, 'companies', company.id), company);
    } catch (error) {
      console.error("Error guardando empresa:", error);
      throw error;
    }
  },

  async deleteCompany(companyId: string) {
    try {
      // Verificar si hay empleados asociados antes de eliminar
      const employees = await this.getEmployees();
      const hasEmployees = employees.some(emp => emp.companyId === companyId);

      if (hasEmployees) {
        throw new Error("No se puede eliminar una empresa que tiene trabajadores asociados.");
      }

      await deleteDoc(doc(db, 'companies', companyId));
    } catch (error) {
      console.error("Error eliminando empresa:", error);
      throw error;
    }
  },

  async getEmployees(): Promise<User[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      return querySnapshot.docs
        .map(doc => ({ ...doc.data() as User, id: doc.id }));
    } catch (error) {
      console.error("Error obteniendo empleados:", error);
      return [];
    }
  },

  async getEmployeesByCompany(companyId: string): Promise<User[]> {
    try {
      const q = query(collection(db, 'users'), where('companyId', '==', companyId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs
        .map(doc => doc.data() as User);
    } catch (error) {
      console.error("Error obteniendo empleados por empresa:", error);
      return [];
    }
  },

  async migrateEmployeesToCompany(companyId: string) {
    try {
      const batch = writeBatch(db);
      const employees = await this.getEmployees();

      employees.forEach(emp => {
        if (!emp.companyId) {
          const userRef = doc(db, 'users', emp.id);
          batch.update(userRef, { companyId });
        }
      });

      await batch.commit();
    } catch (error) {
      console.error("Error en migración masiva:", error);
      throw error;
    }
  },

  /**
   * Actualiza el perfil de un usuario en Firestore.
   * @param userId ID del usuario a actualizar
   * @param profileData Datos a guardar (parcial del perfil)
   * @returns Promise<void>
   */
  async saveUserProfile(userId: string, profileData: Partial<User>): Promise<void> {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, profileData, { merge: true });
  }

};
