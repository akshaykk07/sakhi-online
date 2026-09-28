import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { firestoreDb } from "@/lib/firebase/client";
import { Customer, Order } from "@/types";

const COLLECTION_NAME = "customers";

export const customerService = {
  async getCustomers(search?: string): Promise<Customer[]> {
    if (!firestoreDb) return [];
    try {
      const colRef = collection(firestoreDb, COLLECTION_NAME);
      const snap = await getDocs(query(colRef, orderBy("createdAt", "desc")));
      let list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));

      if (search && search.trim()) {
        const term = search.toLowerCase().trim();
        list = list.filter(
          (c) =>
            c.name?.toLowerCase().includes(term) ||
            c.email?.toLowerCase().includes(term) ||
            c.phone?.includes(term)
        );
      }

      return list;
    } catch {
      const snap = await getDocs(collection(firestoreDb, COLLECTION_NAME));
      let list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
      if (search && search.trim()) {
        const term = search.toLowerCase().trim();
        list = list.filter(
          (c) =>
            c.name?.toLowerCase().includes(term) ||
            c.email?.toLowerCase().includes(term) ||
            c.phone?.includes(term)
        );
      }
      return list;
    }
  },

  async getCustomer(id: string): Promise<Customer | null> {
    if (!firestoreDb) return null;
    const docRef = doc(firestoreDb, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Customer;
  },

  async getCustomerOrders(customerId: string): Promise<Order[]> {
    if (!firestoreDb) return [];
    try {
      const q = query(
        collection(firestoreDb, "orders"),
        where("customerId", "==", customerId),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
    } catch {
      const q = query(collection(firestoreDb, "orders"), where("customerId", "==", customerId));
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Order))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  },
};
