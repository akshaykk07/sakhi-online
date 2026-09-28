import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, Transaction } from "@/lib/firebase/admin";
import { calculateOrderFinancials, validateAndCalculateCoupon } from "@/lib/business-rules";
import { CreateOrderPayload, DEFAULT_BUSINESS_SETTINGS } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body: CreateOrderPayload = await req.json();
    const { customerSnapshot, items, couponCode, paymentMethod, customerId: providedCustomerId } = body;

    if (!customerSnapshot?.name || !customerSnapshot?.email || !customerSnapshot?.phone || !customerSnapshot?.address) {
      return NextResponse.json(
        { error: "Missing required customer shipping information (name, email, phone, address)." },
        { status: 400 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cannot create an order with an empty cart." }, { status: 400 });
    }

    const db = getAdminDb();
    const customerId = providedCustomerId || `cust_${Date.now().toString(36)}`;
    const nowIso = new Date().toISOString();

    // Execute within a Firestore transaction for atomic safety
    const result = await db.runTransaction(async (transaction: Transaction) => {
      // 1. Fetch Business Settings
      const settingsRef = db.collection("settings").doc("business");
      const settingsSnap = await transaction.get(settingsRef);
      const settings = settingsSnap.exists ? settingsSnap.data()! : DEFAULT_BUSINESS_SETTINGS;

      // 2. Fetch and validate each product from Firestore
      const verifiedItems: any[] = [];
      const inventoryUpdates: { ref: any; currentStock: number; newStock: number; name: string; id: string; qty: number }[] = [];

      for (const itemInput of items) {
        if (!itemInput.productId || itemInput.quantity <= 0) {
          throw new Error("Invalid item input data.");
        }

        const prodRef = db.collection("products").doc(itemInput.productId);
        const prodSnap = await transaction.get(prodRef);

        if (!prodSnap.exists) {
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

      // 3. Validate coupon if provided
      let couponDoc: any = null;
      let couponData: any = null;
      if (couponCode && couponCode.trim()) {
        const couponQuery = await transaction.get(
          db.collection("coupons").where("code", "==", couponCode.toUpperCase().trim()).where("active", "==", true).limit(1)
        );
        if (!couponQuery.empty) {
          couponDoc = couponQuery.docs[0];
          couponData = couponDoc.data();
        }
      }

      // 4. Calculate Financials using centralized business rules
      const financials = calculateOrderFinancials(verifiedItems, couponData, 0, settings);

      if (body.deliveryChargeOverride !== undefined && body.deliveryChargeOverride !== null) {
        financials.deliveryCharge = Math.max(0, Number(body.deliveryChargeOverride));
        financials.total = Number((financials.taxableAmount + financials.tax + financials.deliveryCharge).toFixed(2));
      }

      // Populate item taxes and subtotals
      const orderItems = verifiedItems.map((item) => {
        const itemSubtotal = Number((item.unitPrice * item.quantity).toFixed(2));
        const itemTax = Number(((itemSubtotal * (settings.defaultTaxRate || 18)) / 100).toFixed(2));
        return {
          ...item,
          tax: itemTax,
          subtotal: itemSubtotal,
        };
      });

      // 5. Generate Order and References
      const orderRef = db.collection("orders").doc();
      const orderId = orderRef.id;
      const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

      // 6. Apply Inventory Deductions & Record Transactions
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
          reason: `Customer Order #${orderNumber}`,
          referenceId: orderId,
          performedBy: customerId,
          performedByName: customerSnapshot.name,
          createdAt: nowIso,
        });

        // Trigger stock notification if below threshold
        const threshold = Number(settings.defaultLowStockThreshold || 5);
        if (inv.newStock <= threshold) {
          const notifRef = db.collection("notifications").doc();
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

      // If coupon used, increment count
      if (couponDoc) {
        transaction.update(couponDoc.ref, {
          usedCount: (couponData.usedCount || 0) + 1,
          updatedAt: nowIso,
        });
      }

      // 7. Create Order Document
      const initialPaymentStatus = body.paymentStatus || (paymentMethod === "cod" ? "pending" : "paid");
      const initialOrderStatus = body.orderStatus || (paymentMethod === "cod" ? "pending" : "confirmed");

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

      // Status history entry
      const statusHistRef = orderRef.collection("statusHistory").doc();
      transaction.set(statusHistRef, {
        id: statusHistRef.id,
        previousStatus: "none",
        newStatus: initialOrderStatus,
        changedBy: customerId,
        changedByName: customerSnapshot.name,
        timestamp: nowIso,
        note: body.notes || (paymentMethod === "cod" ? "Order placed (Cash on Delivery)" : `Order placed via ${paymentMethod.toUpperCase()}`),
      });

      // 8. Create Payment Record
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
        amount: financials.total,
        currency: settings.currency || "INR",
        gateway: paymentMethod === "cod" ? "cod" : "manual",
        paidAt: initialPaymentStatus === "paid" ? nowIso : null,
        refundedAmount: 0,
        refundStatus: "none",
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      // 9. Update Customer Profile & Lifetime Statistics
      const customerRef = db.collection("customers").doc(customerId);
      const existingCustomerSnap = await transaction.get(customerRef);
      if (existingCustomerSnap.exists) {
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

      // 10. Update Sales Aggregates (Daily, Monthly, Yearly)
      const dayKey = nowIso.slice(0, 10);
      const monthKey = nowIso.slice(0, 7);
      const yearKey = nowIso.slice(0, 4);

      const periodConfigs = [
        { coll: "salesDaily", key: dayKey, period: "daily" },
        { coll: "salesMonthly", key: monthKey, period: "monthly" },
        { coll: "salesYearly", key: yearKey, period: "yearly" },
      ];

      for (const config of periodConfigs) {
        const aggRef = db.collection(config.coll).doc(config.key);
        const aggSnap = await transaction.get(aggRef);

        if (aggSnap.exists) {
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

          transaction.update(aggRef, {
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
          transaction.set(aggRef, {
            id: config.key,
            period: config.period,
            periodKey: config.key,
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

      // 11. Create Admin Notification
      const notifRef = db.collection("notifications").doc();
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
        orderId,
        orderNumber,
        total: financials.total,
        financials,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Order placed and automated sales lifecycle executed successfully.",
      ...result,
    });
  } catch (error: any) {
    console.error("Order Checkout API error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process order." },
      { status: 500 }
    );
  }
}
