import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestoreDb } from "@/lib/firebase/client";
import { BusinessSettings, DEFAULT_BUSINESS_SETTINGS } from "@/types";

const DOC_PATH = "settings/business";

export const settingsService = {
  async getSettings(): Promise<BusinessSettings> {
    if (!firestoreDb) return DEFAULT_BUSINESS_SETTINGS;
    try {
      const docRef = doc(firestoreDb, DOC_PATH);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as BusinessSettings;
      }
      return DEFAULT_BUSINESS_SETTINGS;
    } catch {
      return DEFAULT_BUSINESS_SETTINGS;
    }
  },

  async updateSettings(
    updates: Partial<BusinessSettings>,
    adminId: string = "admin",
    adminName: string = "Administrator"
  ): Promise<BusinessSettings> {
    if (!firestoreDb) throw new Error("Firestore is not initialized.");
    const docRef = doc(firestoreDb, DOC_PATH);
    const existing = await this.getSettings();

    const newSettings: BusinessSettings = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: adminId,
    };

    await setDoc(docRef, newSettings, { merge: true });

    // Audit log
    const auditRef = doc(firestoreDb, "auditLogs", `settings_${Date.now()}`);
    await setDoc(auditRef, {
      id: auditRef.id,
      adminId,
      adminName,
      action: "SETTINGS_UPDATED",
      collection: "settings",
      documentId: "business",
      newValue: updates,
      timestamp: new Date().toISOString(),
    });

    return newSettings;
  },
};
