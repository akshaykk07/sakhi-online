import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, Firestore } from "firebase/firestore";
import { getStorage, connectStorageEmulator, FirebaseStorage } from "firebase/storage";
import { firebaseConfig, getFirebaseConfigStatus } from "./config";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

export function initializeFirebase() {
  const status = getFirebaseConfigStatus();

  if (getApps().length === 0) {
    // If not configured and emulator not requested, return null/safe instances
    if (!status.isConfigured && !status.usingEmulator) {
      return { app: null, auth: null, db: null, storage: null };
    }

    try {
      app = initializeApp(
        status.usingEmulator
          ? {
              apiKey: "demo-key",
              authDomain: "demo-eshop-admin.firebaseapp.com",
              projectId: "demo-eshop-admin",
              storageBucket: "demo-eshop-admin.appspot.com",
              messagingSenderId: "123456789",
              appId: "1:123456789:web:abcdef",
            }
          : firebaseConfig
      );
    } catch (e) {
      console.error("Firebase client initialization error:", e);
    }
  } else {
    app = getApp();
  }

  if (app) {
    if (!auth) auth = getAuth(app);
    if (!db) db = getFirestore(app);
    if (!storage) storage = getStorage(app);

    // If emulator mode requested and in development, connect emulators once
    if (status.usingEmulator && typeof window !== "undefined" && !(window as any).__FIREBASE_EMULATORS_CONNECTED__) {
      (window as any).__FIREBASE_EMULATORS_CONNECTED__ = true;
      try {
        const host = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || "localhost";
        connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
        connectFirestoreEmulator(db, host, 8080);
        connectStorageEmulator(storage, host, 9199);
        console.log("Connected to Firebase Emulators at", host);
      } catch (err) {
        console.warn("Emulators already connected or unavailable:", err);
      }
    }
  }

  return { app, auth, db, storage };
}

// Export pre-initialized instances for direct usage
const instances = initializeFirebase();
export const firebaseApp = instances.app;
export const firebaseAuth = instances.auth;
export const firestoreDb = instances.db;
export const firebaseStorage = instances.storage;

export { auth, db, storage };
