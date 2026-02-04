import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

// Configuración segura cargada desde .env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

// Inicializar App Check
if (typeof window !== 'undefined') {
  if (import.meta.env.DEV) {
    // @ts-ignore
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LdW9M4qAAAAAPuU5Y2vX84V_9S3_G9Z9G9Z9G9Z'),
    isTokenAutoRefreshEnabled: true
  });
}

export const db = getFirestore(app);
export const auth = getAuth(app);
