import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
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
    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        return data;
      }

      const errorMsg = data?.error || "";
      const isCredentialOrServerError =
        res.status >= 500 ||
        errorMsg.includes("Project Id") ||
        errorMsg.includes("credentials") ||
        errorMsg.includes("Firebase Admin") ||
        errorMsg.includes("authentication") ||
        errorMsg.includes("Google APIs") ||
        errorMsg.includes("UNAUTHENTICATED");

      if (isCredentialOrServerError) {
        return await this.adjustStockDirect(payload);
      }

      throw new Error(data.error || "Failed to adjust stock");
    } catch (err: any) {
      if (
        err?.message?.includes("negative stock") ||
        err?.message?.includes("not found")
      ) {
        throw err;
      }
      return await this.adjustStockDirect(payload);
    }
  },

  async adjustStockDirect(payload: {
    productId: string;
    type: InventoryTransactionType;
    quantity: number;
    reason: string;
    adminId?: string;
    adminName?: string;
  }): Promise<{ success: boolean; newStock: number; message: string }> {
    if (!firestoreDb) throw new Error("Firestore client is offline");

    const delta = Number(payload.quantity);
    if (!payload.productId || isNaN(delta) || delta === 0) {
      throw new Error("Invalid product or quantity");
    }

    const adminId = payload.adminId || "admin";
    const adminName = payload.adminName || "Administrator";
    const nowIso = new Date().toISOString();

    return await runTransaction(firestoreDb, async (transaction) => {
      const prodRef = doc(firestoreDb!, "products", payload.productId);
      const prodSnap = await transaction.get(prodRef);

      if (!prodSnap.exists()) {
        throw new Error(`Product ${payload.productId} not found.`);
      }

      const prodData = prodSnap.data()!;
      const previousStock = Number(prodData.stockQuantity || 0);
      const newStock = previousStock + delta;

      if (newStock < 0) {
        throw new Error(
          `Adjustment of ${delta} would result in negative stock. Current stock: ${previousStock}.`
        );
      }

      // Update product stock
      transaction.update(prodRef, {
        stockQuantity: newStock,
        updatedAt: nowIso,
      });

      // Create ledger entry
      const invTxRef = doc(collection(firestoreDb!, COLLECTION_NAME));
      transaction.set(invTxRef, {
        id: invTxRef.id,
        productId: payload.productId,
        productName: prodData.name,
        type: payload.type,
        quantity: delta,
        previousStock,
        newStock,
        reason: payload.reason || `Manual adjustment (${payload.type})`,
        referenceId: invTxRef.id,
        performedBy: adminId,
        performedByName: adminName,
        createdAt: nowIso,
      });

      return {
        success: true,
        newStock,
        message: `Inventory updated for ${prodData.name}. New stock: ${newStock}`,
      };
    });
  },

  async getLowStockProducts(): Promise<Product[]> {
    if (!firestoreDb) return [];
    const prodsSnap = await getDocs(collection(firestoreDb, "products"));
    const list = prodsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
    return list.filter((p) => p.stockQuantity <= (p.lowStockThreshold || 5));
  },
};
