import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { firestoreDb } from "@/lib/firebase/client";
import { PaymentRecord } from "@/types";

const COLLECTION_NAME = "payments";

export const paymentService = {
  async getPayments(limitCount: number = 100): Promise<PaymentRecord[]> {
    if (!firestoreDb) return [];
    try {
      const q = query(collection(firestoreDb, COLLECTION_NAME), orderBy("createdAt", "desc"), limit(limitCount));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentRecord));
    } catch {
      const snap = await getDocs(collection(firestoreDb, COLLECTION_NAME));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as PaymentRecord))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  },

  async simulateGatewayWebhook(payload: {
    event: "payment.captured" | "payment.failed";
    orderId: string;
    transactionId?: string;
    amount?: number;
  }): Promise<any> {
    const res = await fetch("/api/webhooks/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  },
};
