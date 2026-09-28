import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { firestoreDb } from "@/lib/firebase/client";
import { InventoryTransaction, InventoryTransactionType, Product } from "@/types";

const COLLECTION_NAME = "inventoryTransactions";

export interface InventoryFilterOptions {
  productId?: string;
  type?: InventoryTransactionType | "all";
  limit?: number;
}

export const inventoryService = {
  async getTransactions(options: InventoryFilterOptions = {}): Promise<InventoryTransaction[]> {
    if (!firestoreDb) return [];

    const { productId, type, limit: pageSize = 100 } = options;
    const colRef = collection(firestoreDb, COLLECTION_NAME);
    let q = query(colRef);

    if (productId) {
      q = query(q, where("productId", "==", productId));
    }
    if (type && type !== "all") {
      q = query(q, where("type", "==", type));
    }

    try {
      q = query(q, orderBy("createdAt", "desc"), limit(pageSize));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryTransaction));
    } catch {
      const snap = await getDocs(colRef);
      let list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryTransaction));
      if (productId) list = list.filter((t) => t.productId === productId);
      if (type && type !== "all") list = list.filter((t) => t.type === type);
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  },

  async adjustStock(payload: {
    productId: string;
    type: InventoryTransactionType;
    quantity: number;
    reason: string;
    adminId?: string;
    adminName?: string;
  }): Promise<{ success: boolean; newStock: number; message: string }> {
    const res = await fetch("/api/inventory/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to adjust stock");
    }
    return data;
  },

  async getLowStockProducts(): Promise<Product[]> {
    if (!firestoreDb) return [];
    const prodsSnap = await getDocs(collection(firestoreDb, "products"));
    const list = prodsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
    return list.filter((p) => p.stockQuantity <= (p.lowStockThreshold || 5));
  },
};
