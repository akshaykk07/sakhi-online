import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import { firestoreDb } from "@/lib/firebase/client";
import { Notification } from "@/types";

const COLLECTION_NAME = "notifications";

export const notificationService = {
  async getNotifications(limitCount: number = 50): Promise<Notification[]> {
    if (!firestoreDb) return [];
    try {
      const q = query(collection(firestoreDb, COLLECTION_NAME), orderBy("createdAt", "desc"), limit(limitCount));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification));
    } catch {
      try {
        const snap = await getDocs(collection(firestoreDb, COLLECTION_NAME));
        return snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Notification))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } catch (err) {
        console.warn("Could not fetch notifications (client offline or database not created):", err);
        return [];
      }
    }
  },

  subscribeToNotifications(callback: (notifications: Notification[]) => void): () => void {
    if (!firestoreDb) return () => {};
    try {
      const q = query(collection(firestoreDb, COLLECTION_NAME), orderBy("createdAt", "desc"), limit(30));
      return onSnapshot(
        q,
        (snap) => {
          const notifs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification));
          callback(notifs);
        },
        (err) => {
          console.warn("Notification subscription fallback:", err);
        }
      );
    } catch {
      return () => {};
    }
  },

  async markAsRead(id: string): Promise<void> {
    if (!firestoreDb) return;
    const docRef = doc(firestoreDb, COLLECTION_NAME, id);
    await updateDoc(docRef, { read: true });
  },

  async markAllAsRead(): Promise<void> {
    if (!firestoreDb) return;
    const snap = await getDocs(collection(firestoreDb, COLLECTION_NAME));
    const batch = writeBatch(firestoreDb);
    snap.docs.forEach((d) => {
      if (!d.data().read) {
        batch.update(d.ref, { read: true });
      }
    });
    await batch.commit();
  },
};
