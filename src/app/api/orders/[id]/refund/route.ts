import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, Transaction } from "@/lib/firebase/admin";
import { RefundRequestPayload } from "@/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body: RefundRequestPayload & { restoreStock?: boolean } = await req.json();
    const {
      amount,
      reason,
      refundMethod = "manual",
      adminId = "admin",
      adminName = "Administrator",
      restoreStock = true,
    } = body;

    const refundAmount = Number(amount);
    if (isNaN(refundAmount) || refundAmount <= 0) {
      return NextResponse.json({ error: "Invalid refund amount" }, { status: 400 });
    }

    const db = getAdminDb();
    const nowIso = new Date().toISOString();

    const result = await db.runTransaction(async (transaction: Transaction) => {
      const orderRef = db.collection("orders").doc(orderId);
      const orderSnap = await transaction.get(orderRef);

      if (!orderSnap.exists) {
        throw new Error(`Order #${orderId} not found.`);
      }

      const orderData = orderSnap.data()!;
      const currentRefunded = Number(orderData.refundAmount || 0);
      const orderTotal = Number(orderData.total || 0);
      const maxRefundable = Number((orderTotal - currentRefunded).toFixed(2));

      if (refundAmount > maxRefundable) {
        throw new Error(`Refund amount ₹${refundAmount} exceeds maximum refundable balance of ₹${maxRefundable}.`);
      }

      const newTotalRefunded = Number((currentRefunded + refundAmount).toFixed(2));
      const isFullRefund = newTotalRefunded >= orderTotal;

      // Update Order
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

      // Record in statusHistory
      const histRef = orderRef.collection("statusHistory").doc();
      transaction.set(histRef, {
        id: histRef.id,
        previousStatus: orderData.orderStatus,
        newStatus: isFullRefund ? "refunded" : orderData.orderStatus,
        changedBy: adminId,
        changedByName: adminName,
        timestamp: nowIso,
        note: `Processed refund of ₹${refundAmount}. Reason: ${reason || "N/A"} (${refundMethod})`,
      });

      // Update / Create Payment Refund Record
      const paymentQuery = await transaction.get(
        db.collection("payments").where("orderId", "==", orderId).limit(1)
      );

      if (!paymentQuery.empty) {
        const paymentDoc = paymentQuery.docs[0];
        transaction.update(paymentDoc.ref, {
          refundedAmount: newTotalRefunded,
          refundStatus: isFullRefund ? "full" : "partial",
          status: isFullRefund ? "refunded" : "partially_refunded",
          updatedAt: nowIso,
        });
      }

      // Restock inventory if requested and not already restocked
      if (restoreStock && isFullRefund && orderData.items) {
        for (const item of orderData.items) {
          const prodRef = db.collection("products").doc(item.productId);
          const prodSnap = await transaction.get(prodRef);
          if (prodSnap.exists) {
            const currentStock = Number(prodSnap.data()?.stockQuantity || 0);
            const newStock = currentStock + Number(item.quantity);
            transaction.update(prodRef, {
              stockQuantity: newStock,
              updatedAt: nowIso,
            });

            const invTxRef = db.collection("inventoryTransactions").doc();
            transaction.set(invTxRef, {
              id: invTxRef.id,
              productId: item.productId,
              productName: item.name,
              type: "refund",
              quantity: item.quantity,
              previousStock: currentStock,
              newStock,
              reason: `Order #${orderData.orderNumber} refund restock`,
              referenceId: orderId,
              performedBy: adminId,
              performedByName: adminName,
              createdAt: nowIso,
            });
          }
        }
      }

      // Adjust Sales Aggregates
      const dayKey = nowIso.slice(0, 10);
      const monthKey = nowIso.slice(0, 7);
      const yearKey = nowIso.slice(0, 4);

      const periodConfigs = [
        { coll: "salesDaily", key: dayKey },
        { coll: "salesMonthly", key: monthKey },
        { coll: "salesYearly", key: yearKey },
      ];

      for (const config of periodConfigs) {
        const aggRef = db.collection(config.coll).doc(config.key);
        const aggSnap = await transaction.get(aggRef);
        if (aggSnap.exists) {
          const prev = aggSnap.data()!;
          const newRefunds = Number(((prev.refunds || 0) + refundAmount).toFixed(2));
          const newNet = Number(((prev.netSales || 0) - refundAmount).toFixed(2));
          const profit = Number(((prev.profit || 0) - refundAmount).toFixed(2));

          transaction.update(aggRef, {
            refunds: newRefunds,
            netSales: newNet,
            profit,
            updatedAt: nowIso,
          });
        }
      }

      // Audit Log
      const auditRef = db.collection("auditLogs").doc();
      transaction.set(auditRef, {
        id: auditRef.id,
        adminId,
        adminName,
        action: "ORDER_REFUND",
        collection: "orders",
        documentId: orderId,
        previousValue: { refundAmount: currentRefunded },
        newValue: { refundAmount: newTotalRefunded, isFullRefund },
        timestamp: nowIso,
        metadata: {
          orderNumber: orderData.orderNumber,
          refundAmount,
          reason,
          refundMethod,
        },
      });

      return {
        orderNumber: orderData.orderNumber,
        refundAmount,
        totalRefunded: newTotalRefunded,
        isFullRefund,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Refund of ₹${refundAmount} processed successfully.`,
      ...result,
    });
  } catch (error: any) {
    console.error("Refund processing API error:", error);
    return NextResponse.json({ error: error?.message || "Failed to process refund." }, { status: 500 });
  }
}
