export interface FirebaseConfigStatus {
  isConfigured: boolean;
  missingKeys: string[];
  usingEmulator: boolean;
  projectId: string;
  databaseId: string;
}

export const firebaseDatabaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "default";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCu6dLGDsAB6ETVaf0GxaYkJnN48rybiHE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "sakhi-online.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sakhi-online",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "sakhi-online.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "369685598722",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:369685598722:web:18be2bb15de89e64880d1b",
};

export function getFirebaseConfigStatus(): FirebaseConfigStatus {
  const missingKeys: string[] = [];
  if (!firebaseConfig.apiKey) missingKeys.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!firebaseConfig.authDomain) missingKeys.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!firebaseConfig.projectId) missingKeys.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!firebaseConfig.storageBucket) missingKeys.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  if (!firebaseConfig.messagingSenderId) missingKeys.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
  if (!firebaseConfig.appId) missingKeys.push("NEXT_PUBLIC_FIREBASE_APP_ID");

  const usingEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";

  return {
    isConfigured: missingKeys.length === 0 || usingEmulator,
    missingKeys,
    usingEmulator,
    projectId: firebaseConfig.projectId || (usingEmulator ? "demo-eshop-admin" : "not-configured"),
    databaseId: firebaseDatabaseId,
  };
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseConfigStatus().isConfigured;
}
