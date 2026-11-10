import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver, GoogleAuthProvider, connectAuthEmulator, type Dependencies } from 'firebase/auth';
import { getFirestore, initializeFirestore, connectFirestoreEmulator, disableNetwork, type Firestore } from 'firebase/firestore';
import { EIKEN_APP_ID, validateEikenTarget } from './eiken/config';

const env = import.meta.env;
const target = validateEikenTarget(env);
export const FIREBASE_CONFIGURED = target.enabled;
export const USE_EMULATORS = env.VITE_EIKEN_USE_EMULATORS === 'true';
export const AUTH_SAME_ORIGIN_ACTIVE = false;
if (USE_EMULATORS && target.enabled) throw new Error('エミュレータと本番接続は同時に指定できません。');
const projectId = target.enabled ? target.projectId : 'demo-manatobi-eiken';
const app = getApps().find(app => app.name === EIKEN_APP_ID) || initializeApp({
  apiKey: target.enabled ? env.VITE_EIKEN_FIREBASE_API_KEY : 'demo-eiken-not-a-production-key',
  projectId,
  authDomain: target.enabled ? env.VITE_EIKEN_FIREBASE_AUTH_DOMAIN : `${projectId}.firebaseapp.com`,
  appId: target.enabled ? env.VITE_EIKEN_FIREBASE_APP_ID : '1:123:web:eiken',
  storageBucket: target.enabled ? env.VITE_EIKEN_FIREBASE_STORAGE_BUCKET : undefined,
  messagingSenderId: target.enabled ? env.VITE_EIKEN_FIREBASE_MESSAGING_SENDER_ID : undefined,
}, EIKEN_APP_ID);
export function authDependencies(_native: boolean): Dependencies {
  return { persistence: [indexedDBLocalPersistence, browserLocalPersistence], popupRedirectResolver: browserPopupRedirectResolver };
}
function initAuth() {
  // Node-based validation has no browser persistence/resolver classes.
  if (typeof window === 'undefined') return getAuth(app);
  try { return initializeAuth(app, authDependencies(false)); } catch { return getAuth(app); }
}
export const auth = initAuth();
export const provider = new GoogleAuthProvider();
function createDb(): Firestore {
  try { return initializeFirestore(app, { experimentalAutoDetectLongPolling: true }); } catch { return getFirestore(app); }
}
export const db = createDb();
if (USE_EMULATORS) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
} else if (!target.enabled) {
  void disableNetwork(db);
}
