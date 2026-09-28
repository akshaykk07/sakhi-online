import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

interface OrderItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

interface CreateOrderRequest {
  customerId?: string;
  customerSnapshot: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pinCode: string;
    notes?: string;
  };
  items: OrderItemInput[];
  couponCode?: string;
  paymentMethod: "card" | "upi" | "netbanking" | "cod" | "wallet";
}

/**
 * 1. createOrder (HTTPS Callable Function)
 * Atomically validates inventory & prices, creates order, reduces stock, creates inventory ledger transactions,
 * creates initial payment record, updates customer record, updates sales aggregates, and triggers notifications.
 */
export const createOrder = functions.https.onCall(async (data: CreateOrderRequest, context) => {
  const { customerSnapshot, items, couponCode, paymentMethod } = data;

  if (!customerSnapshot?.name || !customerSnapshot?.email || !customerSnapshot?.phone) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required customer information.");
  }
  if (!items || items.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "Cart is empty.");
  }

  const customerId = context.auth?.uid || data.customerId || `cust_${Date.now()}`;

  // Execute in a Firestore transaction to prevent race conditions
  return await db.runTransaction(async (transaction) => {
    // 1. Fetch settings
    const settingsDoc = await transaction.get(db.collection("settings").doc("business"));
    const settings = settingsDoc.exists ? settingsDoc.data() : { deliveryCharge: 50, freeDeliveryThreshold: 1000, defaultTaxRate: 18 };
    const deliveryBaseCharge = Number(settings?.deliveryCharge ?? 50);
    const freeDeliveryThreshold = Number(settings?.freeDeliveryThreshold ?? 1000);
    const taxRate = Number(settings?.defaultTaxRate ?? 18);

    // 2. Fetch and validate each product
    const orderItems: any[] = [];
    let subtotal = 0;
    let totalCost = 0;
    let totalQuantity = 0;
    const inventoryUpdates: { ref: admin.firestore.DocumentReference; currentStock: number; newStock: number; name: string; id: string; qty: number }[] = [];

    for (const itemInput of items) {
      if (itemInput.quantity <= 0) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid item quantity.");
      }
      const prodRef = db.collection("products").doc(itemInput.productId);
      const prodDoc = await transaction.get(prodRef);

      if (!prodDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Product ${itemInput.productId} not found.`);
      }

      const prodData = prodDoc.data()!;
      if (prodData.status !== "active") {
        throw new functions.https.HttpsError("failed-precondition", `Product "${prodData.name}" is not active.`);
      }

      const currentStock = Number(prodData.stockQuantity || 0);
      if (currentStock < itemInput.quantity) {
        throw new functions.https.HttpsError(
          "resource-exhausted",
          `Insufficient stock for "${prodData.name}". Available: ${currentStock}, requested: ${itemInput.quantity}`
        );
      }

      const unitPrice = Number(prodData.discountPrice && prodData.discountPrice > 0 ? prodData.discountPrice : prodData.sellingPrice);
      const costPrice = Number(prodData.costPrice || 0);
      const itemSubtotal = Number((unitPrice * itemInput.quantity).toFixed(2));

      orderItems.push({
        productId: itemInput.productId,
        name: prodData.name,
        sku: prodData.sku || "N/A",
        image: prodData.images?.[0] || "",
        quantity: itemInput.quantity,
        unitPrice,
        costPrice,
        discount: 0,
        tax: Number(((itemSubtotal * taxRate) / 100).toFixed(2)),
        subtotal: itemSubtotal,
        variantId: itemInput.variantId || null,
      });

      subtotal += itemSubtotal;
      totalCost += costPrice * itemInput.quantity;
      totalQuantity += itemInput.quantity;

      inventoryUpdates.push({
        ref: prodRef,
        currentStock,
        newStock: currentStock - itemInput.quantity,
        name: prodData.name,
        id: itemInput.productId,
        qty: itemInput.quantity,
      });
    }

    subtotal = Number(subtotal.toFixed(2));

    // 3. Validate coupon if provided
    let discount = 0;
    let validCouponId = null;
    let couponRef = null;
    if (couponCode) {
      const couponQuery = await transaction.get(
        db.collection("coupons").where("code", "==", couponCode.toUpperCase().trim()).where("active", "==", true).limit(1)
      );
      if (!couponQuery.empty) {
        const cDoc = couponQuery.docs[0];
        const cData = cDoc.data();
        const now = Date.now();
        const validStart = new Date(cData.startDate).getTime() <= now;
        const validEnd = new Date(cData.expiryDate).getTime() >= now;
        const underLimit = !cData.usageLimit || (cData.usedCount || 0) < cData.usageLimit;
        const meetsMin = !cData.minimumOrderAmount || subtotal >= cData.minimumOrderAmount;

        if (validStart && validEnd && underLimit && meetsMin) {
          validCouponId = cDoc.id;
          couponRef = cDoc.ref;
          if (cData.type === "percentage") {
            discount = (subtotal * Number(cData.value)) / 100;
            if (cData.maximumDiscount && cData.maximumDiscount > 0) {
              discount = Math.min(discount, Number(cData.maximumDiscount));
            }
          } else {
            discount = Math.min(Number(cData.value), subtotal);
          }
          discount = Number(discount.toFixed(2));
        }
      }
    }

    const taxableAmount = Math.max(0, Number((subtotal - discount).toFixed(2)));
    const tax = Number(((taxableAmount * taxRate) / 100).toFixed(2));
    const deliveryCharge = freeDeliveryThreshold > 0 && taxableAmount >= freeDeliveryThreshold ? 0 : deliveryBaseCharge;
    const finalTotal = Number((taxableAmount + tax + deliveryCharge).toFixed(2));

    // 4. Generate Order ID & Number
    const orderRef = db.collection("orders").doc();
    const orderId = orderRef.id;
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const nowIso = new Date().toISOString();

    // 5. Update Inventory & create transactions
    for (const inv of inventoryUpdates) {
      transaction.update(inv.ref, {
        stockQuantity: inv.newStock,
        updatedAt: nowIso,
      });

      const invTxRef = db.collection("inventoryTransactions").doc();
      transaction.set(invTxRef, {
        id: invTxRef.id,
        productId: inv.id,
        productName: inv.name,
        type: "order",
        quantity: -inv.qty,
        previousStock: inv.currentStock,
        newStock: inv.newStock,
        reason: `Order ${orderNumber}`,
        referenceId: orderId,
        performedBy: customerId,
        performedByName: customerSnapshot.name,
        createdAt: nowIso,
      });

      // Notification for low stock
      if (inv.newStock <= 5) {
        const notifRef = db.collection("notifications").doc();
        transaction.set(notifRef, {
          id: notifRef.id,
          type: inv.newStock === 0 ? "out_of_stock" : "low_stock",
          title: inv.newStock === 0 ? `Product Out of Stock: ${inv.name}` : `Low Stock Alert: ${inv.name}`,
          message: `${inv.name} has ${inv.newStock} units left in stock.`,
          read: false,
          referenceId: inv.id,
          referenceType: "product",
          createdAt: nowIso,
        });
      }
    }

    // Increment coupon used count if used
    if (couponRef) {
      transaction.update(couponRef, {
        usedCount: admin.firestore.FieldValue.increment(1),
        updatedAt: nowIso,
      });
    }

    // 6. Create Order Document
    const initialPaymentStatus = paymentMethod === "cod" ? "pending" : "pending";
    const initialOrderStatus = "pending";

    const orderData = {
      id: orderId,
      orderNumber,
      customerId,
      customerSnapshot,
      items: orderItems,
      subtotal,
      discount,
      tax,
      deliveryCharge,
      total: finalTotal,
      paymentMethod,
      paymentStatus: initialPaymentStatus,
      transactionId: null,
      orderStatus: initialOrderStatus,
      couponId: validCouponId,
      couponCode: couponCode || null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    transaction.set(orderRef, orderData);

    // Order status history
    const historyRef = orderRef.collection("statusHistory").doc();
    transaction.set(historyRef, {
      id: historyRef.id,
      previousStatus: "none",
      newStatus: initialOrderStatus,
      changedBy: customerId,
      changedByName: customerSnapshot.name,
      timestamp: nowIso,
      note: "Customer placed new order",
    });

    // 7. Create Payment Record
    const paymentRef = db.collection("payments").doc();
    transaction.set(paymentRef, {
      id: paymentRef.id,
      orderId,
      orderNumber,
      customerId,
      customerEmail: customerSnapshot.email,
      method: paymentMethod,
      status: initialPaymentStatus,
      transactionId: `TXN-${orderNumber}`,
      amount: finalTotal,
      currency: "INR",
      gateway: paymentMethod === "cod" ? "cod" : "manual",
      refundedAmount: 0,
      refundStatus: "none",
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    // 8. Update or create Customer aggregate
    const custRef = db.collection("customers").doc(customerId);
    transaction.set(
      custRef,
      {
        id: customerId,
        name: customerSnapshot.name,
        email: customerSnapshot.email,
        phone: customerSnapshot.phone,
        address: customerSnapshot.address,
        city: customerSnapshot.city,
        state: customerSnapshot.state,
        pinCode: customerSnapshot.pinCode,
        totalOrders: admin.firestore.FieldValue.increment(1),
        totalSpending: admin.firestore.FieldValue.increment(finalTotal),
        lastOrderDate: nowIso,
        status: "active",
        updatedAt: nowIso,
      },
      { merge: true }
    );

    // 9. Update Sales Aggregates (Daily, Monthly, Yearly)
    const dateObj = new Date();
    const dayKey = dateObj.toISOString().slice(0, 10); // YYYY-MM-DD
    const monthKey = dayKey.slice(0, 7); // YYYY-MM
    const yearKey = dayKey.slice(0, 4); // YYYY

    const aggregates = [
      { coll: "salesDaily", key: dayKey, period: "daily" },
      { coll: "salesMonthly", key: monthKey, period: "monthly" },
      { coll: "salesYearly", key: yearKey, period: "yearly" },
    ];

    for (const agg of aggregates) {
      const aggRef = db.collection(agg.coll).doc(agg.key);
      transaction.set(
        aggRef,
        {
          id: agg.key,
          period: agg.period,
          periodKey: agg.key,
          grossSales: admin.firestore.FieldValue.increment(subtotal),
          discounts: admin.firestore.FieldValue.increment(discount),
          netSales: admin.firestore.FieldValue.increment(subtotal - discount),
          taxes: admin.firestore.FieldValue.increment(tax),
          deliveryCharges: admin.firestore.FieldValue.increment(deliveryCharge),
          orderCount: admin.firestore.FieldValue.increment(1),
          itemsSold: admin.firestore.FieldValue.increment(totalQuantity),
          costOfGoodsSold: admin.firestore.FieldValue.increment(totalCost),
          updatedAt: nowIso,
        },
        { merge: true }
      );
    }

    // 10. Admin Notification for new order
    const orderNotifRef = db.collection("notifications").doc();
    transaction.set(orderNotifRef, {
      id: orderNotifRef.id,
      type: "new_order",
      title: `New Order Received: ${orderNumber}`,
      message: `${customerSnapshot.name} placed order #${orderNumber} for ₹${finalTotal}.`,
      read: false,
      referenceId: orderId,
      referenceType: "order",
      createdAt: nowIso,
    });

    return {
      success: true,
      orderId,
      orderNumber,
      total: finalTotal,
      message: "Order placed and lifecycle automated successfully.",
    };
  });
});

/**
 * 2. processPaymentWebhook (HTTPS endpoint for Razorpay/Stripe webhooks)
 */
export const processPaymentWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const { event, payload } = req.body;
  const nowIso = new Date().toISOString();

  try {
    // Example handling for payment success
    if (event === "payment.captured" || event === "charge.successful") {
      const orderId = payload?.orderId || payload?.payment?.entity?.notes?.orderId;
      const transactionId = payload?.paymentId || payload?.payment?.entity?.id || `GATEWAY-${Date.now()}`;

      if (!orderId) {
        res.status(400).json({ error: "Missing orderId in webhook" });
        return;
      }

      await db.runTransaction(async (transaction) => {
        const orderRef = db.collection("orders").doc(orderId);
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists) return;

        const orderData = orderDoc.data()!;
        if (orderData.paymentStatus === "paid") {
          // Idempotency: Already marked as paid
          return;
        }

        // Update Order
        transaction.update(orderRef, {
          paymentStatus: "paid",
          orderStatus: "confirmed",
          transactionId,
          updatedAt: nowIso,
        });

        // Add history
        const histRef = orderRef.collection("statusHistory").doc();
        transaction.set(histRef, {
          id: histRef.id,
          previousStatus: orderData.orderStatus,
          newStatus: "confirmed",
          changedBy: "payment_gateway",
          changedByName: "Gateway Webhook",
          timestamp: nowIso,
          note: `Payment confirmed via webhook (${transactionId})`,
        });

        // Update payment record
        const paymentQuery = await transaction.get(
          db.collection("payments").where("orderId", "==", orderId).limit(1)
        );
        if (!paymentQuery.empty) {
          transaction.update(paymentQuery.docs[0].ref, {
            status: "paid",
            transactionId,
            paidAt: nowIso,
            updatedAt: nowIso,
          });
        }
      });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});
