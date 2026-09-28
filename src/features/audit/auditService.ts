import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { firestoreDb } from "@/lib/firebase/client";
import { AuditLog } from "@/types";

const COLLECTION_NAME = "auditLogs";

export const auditService = {
  async getAuditLogs(limitCount: number = 100): Promise<AuditLog[]> {
    if (!firestoreDb) return [];
    try {
      const q = query(collection(firestoreDb, COLLECTION_NAME), orderBy("timestamp", "desc"), limit(limitCount));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog));
    } catch {
      const snap = await getDocs(collection(firestoreDb, COLLECTION_NAME));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as AuditLog))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  },
};
