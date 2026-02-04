/**
 * SCRIPT DE ADMINISTRACIÓN: Asignación de Roles Seguros (Custom Claims)
 * Versión compatible con ES Modules (Vite/Node 20+)
 */

import admin from 'firebase-admin';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

// Buscamos el archivo de clave de servicio (puede tener nombres largos de Firebase)
const files = readdirSync(ROOT_DIR);
const serviceAccountFile = files.find(f => f.endsWith('.json') && f.includes('firebase-adminsdk'));

if (!serviceAccountFile) {
    console.error('❌ Error: No se encontró el archivo de clave de servicio JSON en la raíz.');
    console.log('Por favor, descarga el JSON de "Cuentas de servicio" en Firebase y colócalo en la raíz del proyecto.');
    process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(join(ROOT_DIR, serviceAccountFile), 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const email = process.argv[2];
const role = process.argv[3] || 'ADMIN'; // Ahora por defecto es ADMIN para facilitar tu tarea

if (!email) {
    console.error('❌ Error: Debes proporcionar un email.');
    console.log('Uso: node scripts/set-admin-claim.js usuario@ejemplo.com ADMIN');
    process.exit(1);
}

async function setRole(userEmail, userRole) {
    try {
        const user = await admin.auth().getUserByEmail(userEmail);
        await admin.auth().setCustomUserClaims(user.uid, { role: userRole });
        console.log(`✅ Éxito: El usuario ${userEmail} ahora tiene el rol REAL (Claim): ${userRole}`);

        // Sincronizamos con Firestore para la UI
        const db = admin.firestore();
        await db.collection('users').doc(user.uid).update({ role: userRole });
        console.log(`✅ Documento de Firestore sincronizado.`);

        console.log('\nRecuerda cerrar sesión y volver a entrar en la App para que los cambios surtan efecto.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error asignando rol:', error);
        process.exit(1);
    }
}

setRole(email, role);
