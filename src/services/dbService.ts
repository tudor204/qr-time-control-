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
  deleteDoc
} from 'firebase/firestore';
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

  // OBTENER TODOS LOS EMPLEADOS (Para el Admin)
  async getEmployees(): Promise<User[]> {
    const querySnapshot = await getDocs(collection(db, 'users'));
    return querySnapshot.docs.map(doc => doc.data() as User);
  },

  // AGREGAR REGISTRO DE ASISTENCIA
  // He añadido 'type' como parámetro para que la App decida qué guardar
  async addRecord(userId: string, userName: string, location: string, type: RecordType) {
    try {
      const newRecord = {
        userId,
        userName,
        location,
        timestamp: new Date().toISOString(), // Mantenemos ISO para tu lógica de App y PDF
        type // 'IN' o 'OUT'
      };
      return await addDoc(collection(db, 'records'), newRecord);
    } catch (error) {
      console.error("Error en addRecord:", error);
      throw error;
    }
  },

  // OBTENER REGISTROS (Filtrados por usuario si no es admin)
  async getRecords(userId?: string): Promise<AttendanceRecord[]> {
    try {
      const recordsRef = collection(db, 'records');
      let q;

      if (userId) {
        // Consulta para empleado específico
        q = query(recordsRef, where('userId', '==', userId), orderBy('timestamp', 'desc'));
      } else {
        // Consulta para admin (todos los registros)
        q = query(recordsRef, orderBy('timestamp', 'desc'));
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        ...(doc.data() as any),
        id: doc.id // Incluimos el ID de Firebase por si lo necesitas
      } as AttendanceRecord));
    } catch (error) {
      console.error("Error obteniendo registros:", error);
      return [];
    }
  },

  // ELIMINAR USUARIO
  async deleteUser(uid: string) {
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      console.error("Error eliminando usuario:", error);
      throw error;
    }
  },

  // GESTIONAR AUSENCIAS
  async addAbsence(absence: Omit<Absence, 'id' | 'createdAt'>) {
    try {
      const data: any = {
        ...absence,
        createdAt: new Date().toISOString()
      };

      // Eliminar campos undefined para evitar errores de Firestore
      Object.keys(data).forEach(key =>
        data[key] === undefined && delete data[key]
      );

      return await addDoc(collection(db, 'absences'), data);
    } catch (error) {
      console.error("Error en addAbsence:", error);
      throw error;
    }
  },

  async getAbsences(userId?: string): Promise<Absence[]> {
    try {
      const absenceRef = collection(db, 'absences');
      let q;
      if (userId) {
        q = query(absenceRef, where('userId', '==', userId), orderBy('date', 'desc'));
      } else {
        q = query(absenceRef, orderBy('date', 'desc'));
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

  async deleteAbsence(id: string) {
    try {
      await deleteDoc(doc(db, 'absences', id));
    } catch (error) {
      console.error("Error eliminando ausencia:", error);
      throw error;
    }
  }

};
