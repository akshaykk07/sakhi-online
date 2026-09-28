import { getApps, initializeApp, cert, applicationDefault, App } from "firebase-admin/app";
import { getFirestore, Firestore, FieldValue, Transaction } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";
import { getStorage, Storage } from "firebase-admin/storage";

let adminApp: App | undefined;

export function getFirebaseAdminApp(): App {
  const currentApps = getApps();
  if (currentApps.length > 0) {
    return currentApps[0]!;
  }

  const usingEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    (usingEmulator ? "demo-eshop-admin" : undefined);

  if (usingEmulator) {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "localhost:8080";
    process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "localhost:9099";
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || "localhost:9199";
  }

  // 1. Try service account JSON if supplied
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    try {
      let parsedKey;
      if (serviceAccountKey.startsWith("{")) {
        parsedKey = JSON.parse(serviceAccountKey);
      } else {
        const decoded = Buffer.from(serviceAccountKey, "base64").toString("utf-8");
        parsedKey = JSON.parse(decoded);
      }

      adminApp = initializeApp({
        credential: cert(parsedKey),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
        projectId,
      });
      return adminApp;
    } catch (e) {
      console.error("Failed to initialize Firebase Admin with service account key:", e);
    }
  }

  // 2. Try applicationDefault or projectId
  try {
    adminApp = initializeApp({
      credential: applicationDefault(),
      projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    });
  } catch {
    try {
      adminApp = initializeApp({
        projectId: projectId || "demo-eshop-admin",
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-eshop-admin.appspot.com",
      });
    } catch (finalErr) {
      console.warn("Firebase Admin fallback initialization notice:", finalErr);
    }
  }

  return adminApp!;
}

export function getAdminDb(): Firestore {
  const app = getFirebaseAdminApp();
  return getFirestore(app);
}

export function getAdminAuth(): Auth {
  const app = getFirebaseAdminApp();
  return getAuth(app);
}

export function getAdminStorage(): Storage {
  const app = getFirebaseAdminApp();
  return getStorage(app);
}

export { FieldValue };
export type { Transaction };
