import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const env = import.meta.env;
const emulator = env.VITE_USE_EMULATOR === 'true';

/**
 * Web config comes from Firebase Hosting itself (/__/firebase/init.json), so no
 * project keys live in the repository or need to be typed anywhere. VITE_FIREBASE_*
 * variables still override it for local development.
 */
async function loadOptions(): Promise<FirebaseOptions> {
  if (env.VITE_FIREBASE_API_KEY || emulator) {
    return {
      apiKey: env.VITE_FIREBASE_API_KEY ?? 'demo-key',
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'demo-as-daily',
      appId: env.VITE_FIREBASE_APP_ID,
    };
  }
  const res = await fetch('/__/firebase/init.json');
  if (!res.ok) throw new Error('firebase config not found');
  return res.json();
}

export const firebaseOptions = await loadOptions();
export const app = initializeApp(firebaseOptions);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (emulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
