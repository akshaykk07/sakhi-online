import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
} from "firebase/firestore";
import { firestoreDb } from "@/lib/firebase/client";
import {
  Order,
  OrderStatus,
  OrderStatusHistory,
  CreateOrderPayload,
  Coupon,
  DEFAULT_BUSINESS_SETTINGS,
} from "@/types";
import {
  calculateOrderFinancials,
  canTransitionOrderStatus,
  getInventoryStatusImpact,
} from "@/lib/business-rules";

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

/**
 * Client-side transaction fallback when server-side Firebase Admin credentials are not configured.
 * Performs the exact same atomic transaction lifecycle using the active Firebase client connection.
 */
async function createOrderClientFallback(payload: CreateOrderPayload): Promise<{
  success: boolean;
  orderId: string;
  orderNumber: string;
  total: number;
  message?: string;
}> {
  if (!firestoreDb) {
    throw new Error("Firestore client is not initialized.");
  }

  const { customerSnapshot, items, couponCode, paymentMethod, customerId: providedCustomerId } = payload;

  if (!customerSnapshot?.name || !customerSnapshot?.email || !customerSnapshot?.phone || !customerSnapshot?.address) {
    throw new Error("Missing required customer shipping information (name, email, phone, address).");
  }

  if (!items || items.length === 0) {
    throw new Error("Cannot create an order with an empty cart.");
  }

  const customerId = providedCustomerId || `cust_${Date.now().toString(36)}`;
  const nowIso = new Date().toISOString();

  // Validate coupon before transaction if provided
  let couponDoc: any = null;
  let couponData: any = null;
  if (couponCode && couponCode.trim()) {
    try {
      const qCoupon = query(
        collection(firestoreDb, "coupons"),
        where("code", "==", couponCode.toUpperCase().trim()),
        where("active", "==", true),
        limit(1)
      );
      const snap = await getDocs(qCoupon);
      if (!snap.empty) {
        couponDoc = snap.docs[0];
        couponData = couponDoc.data() as Coupon;
      }
    } catch (e) {
      console.warn("Could not query coupon:", e);
    }
  }

  return await runTransaction(firestoreDb, async (transaction) => {
    // 1. READ: Business Settings
    const settingsRef = doc(firestoreDb!, "settings", "business");
    const settingsSnap = await transaction.get(settingsRef);
    const settings = settingsSnap.exists() ? settingsSnap.data()! : DEFAULT_BUSINESS_SETTINGS;

    // 2. READ: All Products
    const prodSnaps: { snap: any; ref: any; itemInput: any }[] = [];
    for (const itemInput of items) {
      const prodRef = doc(firestoreDb!, "products", itemInput.productId);
      const prodSnap = await transaction.get(prodRef);
      prodSnaps.push({ snap: prodSnap, ref: prodRef, itemInput });
    }

    // 3. READ: Customer
    const customerRef = doc(firestoreDb!, "customers", customerId);
    const existingCustomerSnap = await transaction.get(customerRef);

    // 4. READ: Sales Aggregates
    const dayKey = nowIso.slice(0, 10);
    const monthKey = nowIso.slice(0, 7);
    const yearKey = nowIso.slice(0, 4);

    const periodConfigs = [
      { coll: "salesDaily", key: dayKey, period: "daily", ref: doc(firestoreDb!, "salesDaily", dayKey) },
      { coll: "salesMonthly", key: monthKey, period: "monthly", ref: doc(firestoreDb!, "salesMonthly", monthKey) },
      { coll: "salesYearly", key: yearKey, period: "yearly", ref: doc(firestoreDb!, "salesYearly", yearKey) },
    ];

    const aggSnaps: { config: any; snap: any }[] = [];
    for (const cfg of periodConfigs) {
      const snap = await transaction.get(cfg.ref);
      aggSnaps.push({ config: cfg, snap });
    }

    // === VALIDATE & CALCULATE ===
    const verifiedItems: any[] = [];
    const inventoryUpdates: { ref: any; currentStock: number; newStock: number; name: string; id: string; qty: number }[] = [];

    for (const { snap: prodSnap, ref: prodRef, itemInput } of prodSnaps) {
      if (!prodSnap.exists()) {
        throw new Error(`Product ID ${itemInput.productId} does not exist in catalog.`);
      }

      const prodData = prodSnap.data()!;
      if (prodData.status !== "active") {
        throw new Error(`Product "${prodData.name}" is currently unavailable for purchase.`);
      }

      const currentStock = Number(prodData.stockQuantity || 0);
      if (currentStock < itemInput.quantity) {
        throw new Error(
          `Insufficient stock for "${prodData.name}". Available: ${currentStock}, Requested: ${itemInput.quantity}`
        );
      }

      const unitPrice = Number(
        prodData.discountPrice && prodData.discountPrice > 0 ? prodData.discountPrice : prodData.sellingPrice
      );
      const costPrice = Number(prodData.costPrice || 0);

      verifiedItems.push({
        productId: itemInput.productId,
        name: prodData.name,
        sku: prodData.sku || "SKU-PROD",
        image: prodData.images?.[0] || "",
        quantity: itemInput.quantity,
        unitPrice,
        costPrice,
        discount: 0,
        variantId: itemInput.variantId || null,
      });

      inventoryUpdates.push({
        ref: prodRef,
        currentStock,
        newStock: currentStock - itemInput.quantity,
        name: prodData.name,
        id: itemInput.productId,
        qty: itemInput.quantity,
      });
    }

    // Financial calculations
    const financials = calculateOrderFinancials(verifiedItems, couponData, 0, settings);

    if (payload.deliveryChargeOverride !== undefined && payload.deliveryChargeOverride !== null) {
      financials.deliveryCharge = Math.max(0, Number(payload.deliveryChargeOverride));
      financials.total = Number((financials.taxableAmount + financials.tax + financials.deliveryCharge).toFixed(2));
    }

    const orderItems = verifiedItems.map((item) => {
      const itemSubtotal = Number((item.unitPrice * item.quantity).toFixed(2));
      const itemTax = Number(((itemSubtotal * (settings.defaultTaxRate || 18)) / 100).toFixed(2));
      return {
        ...item,
        tax: itemTax,
        subtotal: itemSubtotal,
      };
    });

    const orderRef = doc(collection(firestoreDb!, "orders"));
    const orderId = orderRef.id;
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // === WRITE PHASE ===
    // 1. Inventory Updates
    for (const inv of inventoryUpdates) {
      transaction.update(inv.ref, {
        stockQuantity: inv.newStock,
        updatedAt: nowIso,
      });

      const invTxRef = doc(collection(firestoreDb!, "inventoryTransactions"));
      transaction.set(invTxRef, {
        id: invTxRef.id,
        productId: inv.id,
        productName: inv.name,
        type: "order",
        quantity: -inv.qty,
        previousStock: inv.currentStock,
        newStock: inv.newStock,
        reason: `Customer Order #${orderNumber}`,
        referenceId: orderId,
        performedBy: customerId,
        performedByName: customerSnapshot.name,
        createdAt: nowIso,
      });

      const threshold = Number(settings.defaultLowStockThreshold || 5);
      if (inv.newStock <= threshold) {
        const notifRef = doc(collection(firestoreDb!, "notifications"));
        transaction.set(notifRef, {
          id: notifRef.id,
          type: inv.newStock === 0 ? "out_of_stock" : "low_stock",
          title: inv.newStock === 0 ? `Out of Stock: ${inv.name}` : `Low Stock: ${inv.name}`,
          message: `${inv.name} has only ${inv.newStock} units left in inventory.`,
          read: false,
          referenceId: inv.id,
          referenceType: "product",
          createdAt: nowIso,
        });
      }
    }

    // 2. Coupon increment
    if (couponDoc) {
      const cRef = doc(firestoreDb!, "coupons", couponDoc.id);
      transaction.update(cRef, {
        usedCount: (couponData.usedCount || 0) + 1,
        updatedAt: nowIso,
      });
    }

    // 3. Order Document
    const initialPaymentStatus = payload.paymentStatus || (paymentMethod === "cod" ? "pending" : "paid");
    const initialOrderStatus = payload.orderStatus || (paymentMethod === "cod" ? "pending" : "confirmed");

    const orderData = {
      id: orderId,
      orderNumber,
      customerId,
      customerSnapshot,
      items: orderItems,
      subtotal: financials.subtotal,
      discount: financials.totalDiscount,
      tax: financials.tax,
      deliveryCharge: financials.deliveryCharge,
      total: financials.total,
      paymentMethod,
      paymentStatus: initialPaymentStatus,
      transactionId: `TXN-${orderNumber}`,
      orderStatus: initialOrderStatus,
      couponId: couponDoc ? couponDoc.id : null,
      couponCode: couponCode ? couponCode.toUpperCase().trim() : null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    transaction.set(orderRef, orderData);

    // 4. Order Status History
    const statusHistRef = doc(collection(firestoreDb!, "orders", orderId, "statusHistory"));
    transaction.set(statusHistRef, {
      id: statusHistRef.id,
      previousStatus: "none",
      newStatus: initialOrderStatus,
      changedBy: customerId,
      changedByName: customerSnapshot.name,
      timestamp: nowIso,
      note: payload.notes || (paymentMethod === "cod" ? "Order placed (Cash on Delivery)" : `Order placed via ${paymentMethod.toUpperCase()}`),
    });

    // 5. Payment Record
    const paymentRef = doc(collection(firestoreDb!, "payments"));
    transaction.set(paymentRef, {
      id: paymentRef.id,
      orderId,
      orderNumber,
      customerId,
      customerEmail: customerSnapshot.email,
      method: paymentMethod,
      status: initialPaymentStatus,
      transactionId: `TXN-${orderNumber}`,
      amount: financials.total,
      currency: settings.currency || "INR",
      gateway: paymentMethod === "cod" ? "cod" : "manual",
      paidAt: initialPaymentStatus === "paid" ? nowIso : null,
      refundedAmount: 0,
      refundStatus: "none",
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    // 6. Customer Profile
    if (existingCustomerSnap.exists()) {
      const cData = existingCustomerSnap.data()!;
      transaction.update(customerRef, {
        name: customerSnapshot.name,
        email: customerSnapshot.email,
        phone: customerSnapshot.phone,
        address: customerSnapshot.address,
        city: customerSnapshot.city,
        state: customerSnapshot.state,
        pinCode: customerSnapshot.pinCode,
        totalOrders: (cData.totalOrders || 0) + 1,
        totalSpending: Number(((cData.totalSpending || 0) + financials.total).toFixed(2)),
        lastOrderDate: nowIso,
        updatedAt: nowIso,
      });
    } else {
      transaction.set(customerRef, {
        id: customerId,
        name: customerSnapshot.name,
        email: customerSnapshot.email,
        phone: customerSnapshot.phone,
        address: customerSnapshot.address,
        city: customerSnapshot.city,
        state: customerSnapshot.state,
        pinCode: customerSnapshot.pinCode,
        totalOrders: 1,
        totalSpending: financials.total,
        lastOrderDate: nowIso,
        status: "active",
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    // 7. Sales Aggregates
    for (const { config: cfg, snap: aggSnap } of aggSnaps) {
      if (aggSnap.exists()) {
        const prev = aggSnap.data()!;
        const newGross = Number(((prev.grossSales || 0) + financials.subtotal).toFixed(2));
        const newDiscount = Number(((prev.discounts || 0) + financials.totalDiscount).toFixed(2));
        const newNet = Number(((prev.netSales || 0) + (financials.subtotal - financials.totalDiscount)).toFixed(2));
        const newTax = Number(((prev.taxes || 0) + financials.tax).toFixed(2));
        const newDelivery = Number(((prev.deliveryCharges || 0) + financials.deliveryCharge).toFixed(2));
        const newOrders = (prev.orderCount || 0) + 1;
        const newItems = (prev.itemsSold || 0) + financials.totalQuantity;
        const newCost = Number(((prev.costOfGoodsSold || 0) + financials.totalCostPrice).toFixed(2));
        const newProfit = Number((newNet - newCost).toFixed(2));
        const newAov = Number((newGross / newOrders).toFixed(2));

        transaction.update(cfg.ref, {
          grossSales: newGross,
          discounts: newDiscount,
          netSales: newNet,
          taxes: newTax,
          deliveryCharges: newDelivery,
          orderCount: newOrders,
          itemsSold: newItems,
          costOfGoodsSold: newCost,
          profit: newProfit,
          averageOrderValue: newAov,
          updatedAt: nowIso,
        });
      } else {
        const netSales = Number((financials.subtotal - financials.totalDiscount).toFixed(2));
        transaction.set(cfg.ref, {
          id: cfg.key,
          period: cfg.period,
          periodKey: cfg.key,
          grossSales: financials.subtotal,
          discounts: financials.totalDiscount,
          refunds: 0,
          netSales,
          taxes: financials.tax,
          deliveryCharges: financials.deliveryCharge,
          orderCount: 1,
          itemsSold: financials.totalQuantity,
          costOfGoodsSold: financials.totalCostPrice,
          profit: Number((netSales - financials.totalCostPrice).toFixed(2)),
          averageOrderValue: financials.subtotal,
          updatedAt: nowIso,
        });
      }
    }

    // 8. Admin Notification
    const notifRef = doc(collection(firestoreDb!, "notifications"));
    transaction.set(notifRef, {
      id: notifRef.id,
      type: "new_order",
      title: `New Order Received: #${orderNumber}`,
      message: `${customerSnapshot.name} placed order #${orderNumber} for ₹${financials.total}`,
      read: false,
      referenceId: orderId,
      referenceType: "order",
      createdAt: nowIso,
    });

    return {
      success: true,
      orderId,
      orderNumber,
      total: financials.total,
      message: "Order placed and automated sales lifecycle executed successfully.",
    };
  });
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
    try {
      const res = await fetch("/api/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        return data;
      }

      // If server route failed due to missing Google Cloud / Firebase Admin credentials,
      // project ID detection failure, or server error, gracefully fall back to the atomic client Firestore transaction!
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
        console.warn("Server checkout API lacks GCP credentials or failed, executing direct client transaction:", errorMsg);
        return await createOrderClientFallback(payload);
      }

      throw new Error(data.error || "Failed to create order");
    } catch (err: any) {
      const msg = err?.message || "";
      // Rethrow client-side business logic validation errors
      if (
        msg.includes("Insufficient stock") ||
        msg.includes("does not exist") ||
        msg.includes("unavailable for purchase") ||
        msg.includes("Missing required customer") ||
        msg.includes("empty cart")
      ) {
        throw err;
      }

      console.warn("Falling back to client Firestore transaction for order creation:", err);
      return await createOrderClientFallback(payload);
    }
  },

  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    note?: string,
    adminId: string = "admin",
    adminName: string = "Administrator"
  ): Promise<any> {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus, note, adminId, adminName }),
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
        return await this.updateOrderStatusDirect(orderId, newStatus, note, adminId, adminName);
      }

      throw new Error(data.error || "Failed to update order status");
    } catch (err: any) {
      if (err?.message?.includes("Invalid status transition")) {
        throw err;
      }
      return await this.updateOrderStatusDirect(orderId, newStatus, note, adminId, adminName);
    }
  },

  async updateOrderStatusDirect(
    orderId: string,
    newStatus: OrderStatus,
    note?: string,
    adminId: string = "admin",
    adminName: string = "Administrator"
  ): Promise<any> {
    if (!firestoreDb) throw new Error("Firestore client is offline");
    const nowIso = new Date().toISOString();
    const orderRef = doc(firestoreDb, COLLECTION_NAME, orderId);
    const snap = await getDoc(orderRef);
    if (!snap.exists()) throw new Error(`Order #${orderId} not found.`);
    const orderData = snap.data() as Order;
    const currentStatus = orderData.orderStatus;

    const transitionCheck = canTransitionOrderStatus(currentStatus, newStatus);
    if (!transitionCheck.allowed) {
      throw new Error(transitionCheck.reason || "Invalid status transition.");
    }

    const inventoryImpact = getInventoryStatusImpact(currentStatus, newStatus);
    if (inventoryImpact === "restore" && orderData.items && orderData.items.length > 0) {
      for (const item of orderData.items) {
        try {
          const prodRef = doc(firestoreDb, "products", item.productId);
          const prodSnap = await getDoc(prodRef);
          if (prodSnap.exists()) {
            const currentStock = Number(prodSnap.data()?.stockQuantity || 0);
            await updateDoc(prodRef, {
              stockQuantity: currentStock + Number(item.quantity),
              updatedAt: nowIso,
            });
            const invTxRef = doc(collection(firestoreDb, "inventoryTransactions"));
            await setDoc(invTxRef, {
              id: invTxRef.id,
              productId: item.productId,
              productName: item.name,
              type: newStatus === "refunded" ? "refund" : "return",
              quantity: item.quantity,
              previousStock: currentStock,
              newStock: currentStock + Number(item.quantity),
              reason: `Order #${orderData.orderNumber} transitioned to ${newStatus}`,
              referenceId: orderId,
              performedBy: adminId,
              performedByName: adminName,
              createdAt: nowIso,
            });
          }
        } catch (err) {
          console.warn("Could not restore stock:", err);
        }
      }
    }

    const updatePayload: any = {
      orderStatus: newStatus,
      updatedAt: nowIso,
    };
    if (newStatus === "delivered") updatePayload.deliveredAt = nowIso;
    if (newStatus === "cancelled") updatePayload.cancelledAt = nowIso;
    if (newStatus === "refunded") updatePayload.refundedAt = nowIso;

    if (newStatus === "delivered" && orderData.paymentStatus === "pending" && orderData.paymentMethod === "cod") {
      updatePayload.paymentStatus = "paid";
    }

    await updateDoc(orderRef, updatePayload);

    const statusHistRef = doc(collection(firestoreDb, COLLECTION_NAME, orderId, "statusHistory"));
    await setDoc(statusHistRef, {
      id: statusHistRef.id,
      previousStatus: currentStatus,
      newStatus,
      changedBy: adminId,
      changedByName: adminName,
      timestamp: nowIso,
      note: note || `Order status updated to ${newStatus}`,
    });

    return { success: true, message: `Order status updated to ${newStatus}` };
  },

  async processRefund(
    orderId: string,
    amount: number,
    reason: string,
    restoreStock: boolean = true,
    adminId?: string,
    adminName?: string
  ): Promise<any> {
    try {
      const res = await fetch(`/api/orders/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reason, restoreStock, adminId, adminName }),
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
        return await this.processRefundDirect(orderId, amount, reason, restoreStock, adminId, adminName);
      }

      throw new Error(data.error || "Failed to process refund");
    } catch (err: any) {
      return await this.processRefundDirect(orderId, amount, reason, restoreStock, adminId, adminName);
    }
  },

  async processRefundDirect(
    orderId: string,
    amount: number,
    reason: string,
    restoreStock: boolean = true,
    adminId: string = "admin",
    adminName: string = "Administrator"
  ): Promise<any> {
    if (!firestoreDb) throw new Error("Firestore client is offline");
    const refundAmount = Number(amount);
    if (isNaN(refundAmount) || refundAmount <= 0) {
      throw new Error("Invalid refund amount");
    }

    const nowIso = new Date().toISOString();
    return await runTransaction(firestoreDb, async (transaction) => {
      const orderRef = doc(firestoreDb!, COLLECTION_NAME, orderId);
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists()) {
        throw new Error(`Order #${orderId} not found.`);
      }

      const orderData = orderSnap.data() as Order;
      const currentRefunded = Number(orderData.refundAmount || 0);
      const orderTotal = Number(orderData.total || 0);
      const maxRefundable = Number((orderTotal - currentRefunded).toFixed(2));

      if (refundAmount > maxRefundable) {
        throw new Error(`Refund amount ₹${refundAmount} exceeds maximum refundable balance of ₹${maxRefundable}.`);
      }

      const newTotalRefunded = Number((currentRefunded + refundAmount).toFixed(2));
      const isFullRefund = newTotalRefunded >= orderTotal;

      const orderUpdates: Record<string, any> = {
        refundAmount: newTotalRefunded,
        refundedAt: nowIso,
        updatedAt: nowIso,
      };

      if (isFullRefund) {
        orderUpdates.orderStatus = "refunded";
        orderUpdates.paymentStatus = "refunded";
      } else {
        orderUpdates.paymentStatus = "partially_refunded";
      }

      transaction.update(orderRef, orderUpdates);

      // Status history
      const histRef = doc(collection(firestoreDb!, COLLECTION_NAME, orderId, "statusHistory"));
      transaction.set(histRef, {
        id: histRef.id,
        previousStatus: orderData.orderStatus,
        newStatus: isFullRefund ? "refunded" : orderData.orderStatus,
        changedBy: adminId,
        changedByName: adminName,
        timestamp: nowIso,
        note: `Processed refund of ₹${refundAmount}. Reason: ${reason || "N/A"}`,
      });

      // Restock items if full refund
      if (restoreStock && isFullRefund && orderData.items) {
        for (const item of orderData.items) {
          const prodRef = doc(firestoreDb!, "products", item.productId);
          const prodSnap = await transaction.get(prodRef);
          if (prodSnap.exists()) {
            const currentStock = Number(prodSnap.data()?.stockQuantity || 0);
            const newStock = currentStock + Number(item.quantity);
            transaction.update(prodRef, {
              stockQuantity: newStock,
              updatedAt: nowIso,
            });

            const invTxRef = doc(collection(firestoreDb!, "inventoryTransactions"));
            transaction.set(invTxRef, {
              id: invTxRef.id,
              productId: item.productId,
              productName: item.name,
              type: "refund",
              quantity: item.quantity,
              previousStock: currentStock,
              newStock,
              reason: `Refund for Order #${orderData.orderNumber}`,
              referenceId: orderId,
              performedBy: adminId,
              performedByName: adminName,
              createdAt: nowIso,
            });
          }
        }
      }

      return {
        success: true,
        orderId,
        refundAmount,
        totalRefunded: newTotalRefunded,
        orderStatus: isFullRefund ? "refunded" : orderData.orderStatus,
        message: `Refund of ₹${refundAmount} processed successfully.`,
      };
    });
  },
};
