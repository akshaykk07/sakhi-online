import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { firestoreDb, firebaseStorage } from "@/lib/firebase/client";
import { Category, CategoryDeleteAction } from "@/types";

const COLLECTION_NAME = "categories";

export const categoryService = {
  async getCategories(): Promise<Category[]> {
    if (!firestoreDb) return [];
    try {
      const colRef = collection(firestoreDb, COLLECTION_NAME);
      const snap = await getDocs(colRef);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
    } catch (e) {
      console.warn("Could not fetch categories (client offline or database not created):", e);
      return [];
    }
  },

  async getCategory(id: string): Promise<Category | null> {
    if (!firestoreDb) return null;
    try {
      const docRef = doc(firestoreDb, COLLECTION_NAME, id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Category;
    } catch (e) {
      console.warn(`Could not fetch category ${id}:`, e);
      return null;
    }
  },

  async createCategory(
    categoryData: Omit<Category, "id" | "productCount" | "createdAt" | "updatedAt">,
    adminId: string = "admin",
    adminName: string = "Administrator"
  ): Promise<Category> {
    if (!firestoreDb) throw new Error("Firestore is not initialized.");
    if (!categoryData.name?.trim()) throw new Error("Category name is required.");

    const docRef = doc(collection(firestoreDb, COLLECTION_NAME));
    const nowIso = new Date().toISOString();
    const slug = categoryData.slug || categoryData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const newCategory: Category = {
      id: docRef.id,
      ...categoryData,
      slug,
      productCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await setDoc(docRef, newCategory);

    // Audit log
    const auditRef = doc(collection(firestoreDb, "auditLogs"));
    await setDoc(auditRef, {
      id: auditRef.id,
      adminId,
      adminName,
      action: "CATEGORY_CREATED",
      collection: COLLECTION_NAME,
      documentId: newCategory.id,
      newValue: { name: newCategory.name, slug: newCategory.slug },
      timestamp: nowIso,
    });

    return newCategory;
  },

  async updateCategory(
    id: string,
    updates: Partial<Category>,
    adminId: string = "admin",
    adminName: string = "Administrator"
  ): Promise<void> {
    if (!firestoreDb) throw new Error("Firestore is not initialized.");
    const docRef = doc(firestoreDb, COLLECTION_NAME, id);
    const nowIso = new Date().toISOString();

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
      action: "CATEGORY_UPDATED",
      collection: COLLECTION_NAME,
      documentId: id,
      newValue: updates,
      timestamp: nowIso,
    });
  },

  async checkCategoryProductsCount(categoryId: string): Promise<number> {
    if (!firestoreDb) return 0;
    const q = query(collection(firestoreDb, "products"), where("categoryId", "==", categoryId));
    const snap = await getDocs(q);
    return snap.size;
  },

  async deleteCategorySafe(
    categoryId: string,
    action: CategoryDeleteAction,
    adminId: string = "admin",
    adminName: string = "Administrator"
  ): Promise<{ affectedProducts: number }> {
    if (!firestoreDb) throw new Error("Firestore is not initialized.");

    const prodsQuery = query(collection(firestoreDb, "products"), where("categoryId", "==", categoryId));
    const prodsSnap = await getDocs(prodsQuery);
    const affectedCount = prodsSnap.size;

    const batch = writeBatch(firestoreDb);

    if (affectedCount > 0) {
      const targetCatId = action.target === "reassign" && action.reassignCategoryId ? action.reassignCategoryId : "uncategorized";
      const targetCatName = action.target === "reassign" ? "Reassigned Category" : "Uncategorized";

      prodsSnap.docs.forEach((d) => {
        batch.update(d.ref, {
          categoryId: targetCatId,
          categoryName: targetCatName,
          updatedAt: new Date().toISOString(),
        });
      });
    }

    // Delete category document
    const catRef = doc(firestoreDb, COLLECTION_NAME, categoryId);
    batch.delete(catRef);

    // Audit log
    const auditRef = doc(collection(firestoreDb, "auditLogs"));
    batch.set(auditRef, {
      id: auditRef.id,
      adminId,
      adminName,
      action: "CATEGORY_DELETED_SAFE",
      collection: COLLECTION_NAME,
      documentId: categoryId,
      timestamp: new Date().toISOString(),
      metadata: {
        affectedProducts: affectedCount,
        resolutionAction: action.target,
        reassignedTo: action.reassignCategoryId || "uncategorized",
      },
    });

    await batch.commit();
    return { affectedProducts: affectedCount };
  },

  async uploadCategoryImage(categoryId: string, file: File): Promise<string> {
    if (!firebaseStorage) throw new Error("Firebase Storage is not initialized.");
    const timestamp = Date.now();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storageRef = ref(firebaseStorage, `categories/${categoryId}/${timestamp}_${cleanFileName}`);
    const snap = await uploadBytes(storageRef, file);
    return await getDownloadURL(snap.ref);
  },
};
