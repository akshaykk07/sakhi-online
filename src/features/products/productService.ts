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
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { firestoreDb, firebaseStorage } from "@/lib/firebase/client";
import { Product, ProductFilterOptions, ProductStatus } from "@/types";
import { removeUndefinedFields } from "@/lib/utils/cleanData";

const COLLECTION_NAME = "products";

export const productService = {
  async getProduct(id: string): Promise<Product | null> {
    if (!firestoreDb) return null;
    try {
      const docRef = doc(firestoreDb, COLLECTION_NAME, id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Product;
    } catch (e) {
      console.warn(`Failed to fetch product ${id}:`, e);
      return null;
    }
  },

  async getProducts(options: ProductFilterOptions = {}): Promise<{
    products: Product[];
    lastDoc?: DocumentSnapshot;
    total?: number;
  }> {
    if (!firestoreDb) return { products: [] };

    const {
      categoryId,
      status,
      stockFilter,
      sortBy = "createdAt",
      sortOrder = "desc",
      limit: pageSize = 50,
      search,
    } = options;

    const colRef = collection(firestoreDb, COLLECTION_NAME);
    let q = query(colRef);

    if (categoryId && categoryId !== "all") {
      q = query(q, where("categoryId", "==", categoryId));
    }

    if (status && status !== "all") {
      q = query(q, where("status", "==", status));
    }

    try {
      q = query(q, orderBy(sortBy, sortOrder), limit(pageSize));
      const snap = await getDocs(q);
      let list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));

      // In-memory filters for non-indexed search or special stock conditions
      if (search && search.trim()) {
        const term = search.toLowerCase().trim();
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            p.sku?.toLowerCase().includes(term) ||
            p.brand?.toLowerCase().includes(term)
        );
      }

      if (stockFilter === "low_stock") {
        list = list.filter((p) => p.stockQuantity <= (p.lowStockThreshold || 5) && p.stockQuantity > 0);
      } else if (stockFilter === "out_of_stock") {
        list = list.filter((p) => p.stockQuantity === 0);
      } else if (stockFilter === "in_stock") {
        list = list.filter((p) => p.stockQuantity > 0);
      }

      return {
        products: list,
        lastDoc: snap.docs[snap.docs.length - 1],
      };
    } catch (e) {
      console.warn("Falling back to un-ordered query:", e);
      try {
        const fallbackSnap = await getDocs(colRef);
        let list = fallbackSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
        return { products: list };
      } catch (err) {
        console.warn("Could not fetch products (client offline or database not created):", err);
        return { products: [] };
      }
    }
  },

  async createProduct(
    productData: Omit<Product, "id" | "createdAt" | "updatedAt">,
    adminId: string = "admin",
    adminName: string = "Administrator"
  ): Promise<Product> {
    if (!firestoreDb) throw new Error("Firestore is not initialized.");

    // Validation
    if (!productData.name?.trim()) throw new Error("Product name is required.");
    if (productData.sellingPrice < 0) throw new Error("Selling price cannot be negative.");
    if (productData.costPrice < 0) throw new Error("Cost price cannot be negative.");
    if (productData.stockQuantity < 0) throw new Error("Stock quantity cannot be negative.");
    if (
      productData.discountPrice !== undefined &&
      productData.discountPrice !== null &&
      productData.discountPrice > productData.sellingPrice
    ) {
      throw new Error("Discount price cannot exceed regular selling price.");
    }

    const docRef = doc(collection(firestoreDb, COLLECTION_NAME));
    const nowIso = new Date().toISOString();
    const slug = productData.slug || productData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const newProduct: Product = {
      id: docRef.id,
      ...productData,
      slug,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await setDoc(docRef, removeUndefinedFields(newProduct));

    // Initial stock in ledger if stock > 0
    if (newProduct.stockQuantity > 0) {
      const invRef = doc(collection(firestoreDb, "inventoryTransactions"));
      await setDoc(
        invRef,
        removeUndefinedFields({
          id: invRef.id,
          productId: newProduct.id,
          productName: newProduct.name,
          type: "stock_in",
          quantity: newProduct.stockQuantity,
          previousStock: 0,
          newStock: newProduct.stockQuantity,
          reason: "Initial inventory setup",
          referenceId: newProduct.id,
          performedBy: adminId,
          performedByName: adminName,
          createdAt: nowIso,
        })
      );
    }

    // Audit log
    const auditRef = doc(collection(firestoreDb, "auditLogs"));
    await setDoc(
      auditRef,
      removeUndefinedFields({
        id: auditRef.id,
        adminId,
        adminName,
        action: "PRODUCT_CREATED",
        collection: COLLECTION_NAME,
        documentId: newProduct.id,
        newValue: { name: newProduct.name, sku: newProduct.sku, price: newProduct.sellingPrice },
        timestamp: nowIso,
      })
    );

    return newProduct;
  },

  async updateProduct(
    id: string,
    updates: Partial<Product>,
    adminId: string = "admin",
    adminName: string = "Administrator"
  ): Promise<void> {
    if (!firestoreDb) throw new Error("Firestore is not initialized.");

    const docRef = doc(firestoreDb, COLLECTION_NAME, id);
    const existing = await getDoc(docRef);
    if (!existing.exists()) throw new Error("Product not found");

    const prevData = existing.data();
    const nowIso = new Date().toISOString();

    await updateDoc(
      docRef,
      removeUndefinedFields({
        ...updates,
        updatedAt: nowIso,
      })
    );

    // Audit log
    const auditRef = doc(collection(firestoreDb, "auditLogs"));
    await setDoc(auditRef, {
      id: auditRef.id,
      adminId,
      adminName,
      action: "PRODUCT_UPDATED",
      collection: COLLECTION_NAME,
      documentId: id,
      previousValue: prevData,
      newValue: removeUndefinedFields(updates),
      timestamp: nowIso,
    });
  },

  async deleteProduct(
    id: string,
    adminId: string = "admin",
    adminName: string = "Administrator"
  ): Promise<void> {
    if (!firestoreDb) throw new Error("Firestore is not initialized.");

    const docRef = doc(firestoreDb, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;

    const data = snap.data();
    await deleteDoc(docRef);

    // Audit log
    const auditRef = doc(collection(firestoreDb, "auditLogs"));
    await setDoc(auditRef, {
      id: auditRef.id,
      adminId,
      adminName,
      action: "PRODUCT_DELETED",
      collection: COLLECTION_NAME,
      documentId: id,
      previousValue: data,
      timestamp: new Date().toISOString(),
    });
  },

  async uploadProductImage(productId: string, file: File): Promise<string> {
    if (!firebaseStorage) throw new Error("Firebase Storage is not initialized.");
    if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Image must be smaller than 5MB.");

    const timestamp = Date.now();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storageRef = ref(firebaseStorage, `products/${productId}/${timestamp}_${cleanFileName}`);

    const snap = await uploadBytes(storageRef, file);
    return await getDownloadURL(snap.ref);
  },

  async deleteProductImage(imageUrl: string): Promise<void> {
    if (!firebaseStorage || !imageUrl) return;
    try {
      const storageRef = ref(firebaseStorage, imageUrl);
      await deleteObject(storageRef);
    } catch (e) {
      console.warn("Could not delete image from storage:", e);
    }
  },
};
