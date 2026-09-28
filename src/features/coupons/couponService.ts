import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  orderBy,
} from "firebase/firestore";
import { firestoreDb } from "@/lib/firebase/client";
import { Coupon, CouponValidationResult } from "@/types";
import { validateAndCalculateCoupon } from "@/lib/business-rules";

const COLLECTION_NAME = "coupons";

export const couponService = {
  async getCoupons(): Promise<Coupon[]> {
    if (!firestoreDb) return [];
    try {
      const snap = await getDocs(query(collection(firestoreDb, COLLECTION_NAME), orderBy("createdAt", "desc")));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Coupon));
    } catch {
      try {
        const snap = await getDocs(collection(firestoreDb, COLLECTION_NAME));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Coupon));
      } catch (err) {
        console.warn("Could not fetch coupons (client offline or database not created):", err);
        return [];
      }
    }
  },

  async createCoupon(
    data: Omit<Coupon, "id" | "usedCount" | "createdAt" | "updatedAt">,
    adminId: string = "admin",
    adminName: string = "Administrator"
  ): Promise<Coupon> {
    if (!firestoreDb) throw new Error("Firestore is not initialized.");
    const docRef = doc(collection(firestoreDb, COLLECTION_NAME));
    const nowIso = new Date().toISOString();

    const newCoupon: Coupon = {
      id: docRef.id,
      ...data,
      code: data.code.toUpperCase().trim(),
      usedCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await setDoc(docRef, newCoupon);

    // Audit log
    const auditRef = doc(collection(firestoreDb, "auditLogs"));
    await setDoc(auditRef, {
      id: auditRef.id,
      adminId,
      adminName,
      action: "COUPON_CREATED",
      collection: COLLECTION_NAME,
      documentId: newCoupon.id,
      newValue: { code: newCoupon.code, type: newCoupon.type, value: newCoupon.value },
      timestamp: nowIso,
    });

    return newCoupon;
  },

  async updateCoupon(
    id: string,
    updates: Partial<Coupon>,
    adminId: string = "admin",
    adminName: string = "Administrator"
  ): Promise<void> {
    if (!firestoreDb) throw new Error("Firestore is not initialized.");
    const docRef = doc(firestoreDb, COLLECTION_NAME, id);
    const nowIso = new Date().toISOString();

    if (updates.code) {
      updates.code = updates.code.toUpperCase().trim();
    }

    await updateDoc(docRef, {
      ...updates,
      updatedAt: nowIso,
    });

    // Audit log
    const auditRef = doc(collection(firestoreDb, "auditLogs"));
    await setDoc(auditRef, {
      id: auditRef.id,
      adminId,
      adminName,
      action: "COUPON_UPDATED",
      collection: COLLECTION_NAME,
      documentId: id,
      newValue: updates,
      timestamp: nowIso,
    });
  },

  async deleteCoupon(id: string, adminId: string = "admin", adminName: string = "Administrator"): Promise<void> {
    if (!firestoreDb) throw new Error("Firestore is not initialized.");
    const docRef = doc(firestoreDb, COLLECTION_NAME, id);
    await deleteDoc(docRef);

    // Audit log
    const auditRef = doc(collection(firestoreDb, "auditLogs"));
    await setDoc(auditRef, {
      id: auditRef.id,
      adminId,
      adminName,
      action: "COUPON_DELETED",
      collection: COLLECTION_NAME,
      documentId: id,
      timestamp: new Date().toISOString(),
    });
  },

  async validateCoupon(code: string, subtotal: number, customerId?: string): Promise<CouponValidationResult> {
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal, customerId }),
      });
      const data = await res.json();
      if (res.ok) {
        return data;
      }
    } catch {
      // Fall through to client-side validation
    }

    if (!firestoreDb) {
      return { valid: false, discountAmount: 0, message: "Firestore is offline" };
    }

    try {
      const cleanCode = code.toUpperCase().trim();
      const q = query(
        collection(firestoreDb, COLLECTION_NAME),
        where("code", "==", cleanCode),
        where("active", "==", true),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        return { valid: false, discountAmount: 0, message: "Invalid or inactive coupon code." };
      }
      const couponDoc = snap.docs[0];
      const coupon = { id: couponDoc.id, ...couponDoc.data() } as Coupon;
      return validateAndCalculateCoupon(coupon, Number(subtotal || 0), 0);
    } catch {
      return { valid: false, discountAmount: 0, message: "Failed to validate coupon." };
    }
  },
};
