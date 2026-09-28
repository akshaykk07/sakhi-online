import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { firestoreDb } from "@/lib/firebase/client";
import { Order, OrderStatus, OrderStatusHistory, CreateOrderPayload } from "@/types";

const COLLECTION_NAME = "orders";

export interface OrderFilterOptions {
  status?: OrderStatus | "all";
  paymentStatus?: string;
  customerId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export const orderService = {
  async getOrders(options: OrderFilterOptions = {}): Promise<Order[]> {
    if (!firestoreDb) return [];

    const { status, customerId, limit: pageSize = 100, search } = options;
    const colRef = collection(firestoreDb, COLLECTION_NAME);
    let q = query(colRef);

    if (customerId) {
      q = query(q, where("customerId", "==", customerId));
    }

    if (status && status !== "all") {
      q = query(q, where("orderStatus", "==", status));
    }

    try {
      q = query(q, orderBy("createdAt", "desc"), limit(pageSize));
      const snap = await getDocs(q);
      let list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));

      if (search && search.trim()) {
        const term = search.toLowerCase().trim();
        list = list.filter(
          (o) =>
            o.orderNumber?.toLowerCase().includes(term) ||
            o.customerSnapshot?.name?.toLowerCase().includes(term) ||
            o.customerSnapshot?.email?.toLowerCase().includes(term) ||
            o.customerSnapshot?.phone?.includes(term)
        );
      }

      return list;
    } catch (e) {
      console.warn("Falling back to unordered orders query:", e);
      try {
        const fallbackSnap = await getDocs(colRef);
        let list = fallbackSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
        return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } catch (err) {
        console.warn("Could not fetch orders (client offline or database not created):", err);
        return [];
      }
    }
  },

  async getOrder(id: string): Promise<Order | null> {
    if (!firestoreDb) return null;
    try {
      const docRef = doc(firestoreDb, COLLECTION_NAME, id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Order;
    } catch (e) {
      console.warn(`Could not fetch order ${id}:`, e);
      return null;
    }
  },

  async getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
    if (!firestoreDb) return [];
    try {
      const colRef = collection(firestoreDb, COLLECTION_NAME, orderId, "statusHistory");
      const snap = await getDocs(query(colRef, orderBy("timestamp", "asc")));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderStatusHistory));
    } catch {
      try {
        const colRef = collection(firestoreDb, COLLECTION_NAME, orderId, "statusHistory");
        const snap = await getDocs(colRef);
        return snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as OrderStatusHistory))
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      } catch {
        return [];
      }
    }
  },

  async createCustomerOrder(payload: CreateOrderPayload): Promise<{
    success: boolean;
    orderId: string;
    orderNumber: string;
    total: number;
    message?: string;
  }> {
    const res = await fetch("/api/orders/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to create order");
    }
    return data;
  },

  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    note?: string,
    adminId?: string,
    adminName?: string
  ): Promise<any> {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newStatus, note, adminId, adminName }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to update order status");
    }
    return data;
  },

  async processRefund(
    orderId: string,
    amount: number,
    reason: string,
    restoreStock: boolean = true,
    adminId?: string,
    adminName?: string
  ): Promise<any> {
    const res = await fetch(`/api/orders/${orderId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, reason, restoreStock, adminId, adminName }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to process refund");
    }
    return data;
  },
};
