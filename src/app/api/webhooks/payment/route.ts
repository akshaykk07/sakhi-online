import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, Transaction } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // Optional webhook secret check
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const incomingSecret = req.headers.get("x-webhook-secret");
    if (webhookSecret && incomingSecret && incomingSecret !== webhookSecret) {
      return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
    }

    const { event, orderId, paymentId, transactionId, status, amount } = body;
    const db = getAdminDb();
    const nowIso = new Date().toISOString();

    const targetOrderId = orderId || body?.payload?.payment?.entity?.notes?.orderId;
    const targetTxnId = transactionId || paymentId || `TXN-${Date.now()}`;

    if (!targetOrderId) {
      return NextResponse.json({ error: "Missing order reference in webhook" }, { status: 400 });
    }

    // Process atomically
    const result = await db.runTransaction(async (transaction: Transaction) => {
      const orderRef = db.collection("orders").doc(targetOrderId);
      const orderSnap = await transaction.get(orderRef);

      if (!orderSnap.exists) {
        throw new Error(`Order #${targetOrderId} not found.`);
      }

      const orderData = orderSnap.data()!;

      // Idempotency: If already paid and status is paid, skip duplicate processing
      if (orderData.paymentStatus === "paid" && (event === "payment.captured" || status === "paid")) {
        return { duplicate: true, message: "Order is already marked as paid." };
      }

      const isSuccess = event === "payment.captured" || event === "charge.successful" || status === "paid";
      const isFailed = event === "payment.failed" || status === "failed";

      if (isSuccess) {
        transaction.update(orderRef, {
          paymentStatus: "paid",
          orderStatus: orderData.orderStatus === "pending" ? "confirmed" : orderData.orderStatus,
          transactionId: targetTxnId,
          updatedAt: nowIso,
        });

        const histRef = orderRef.collection("statusHistory").doc();
        transaction.set(histRef, {
          id: histRef.id,
          previousStatus: orderData.orderStatus,
          newStatus: orderData.orderStatus === "pending" ? "confirmed" : orderData.orderStatus,
          changedBy: "gateway_webhook",
          changedByName: "Payment Webhook Gateway",
          timestamp: nowIso,
          note: `Payment confirmed via webhook (${targetTxnId})`,
        });

        // Update payment record
        const paymentQuery = await transaction.get(
          db.collection("payments").where("orderId", "==", targetOrderId).limit(1)
        );
        if (!paymentQuery.empty) {
          transaction.update(paymentQuery.docs[0].ref, {
            status: "paid",
            transactionId: targetTxnId,
            paidAt: nowIso,
            updatedAt: nowIso,
          });
        }
      } else if (isFailed) {
        transaction.update(orderRef, {
          paymentStatus: "failed",
          updatedAt: nowIso,
        });

        const notifRef = db.collection("notifications").doc();
        transaction.set(notifRef, {
          id: notifRef.id,
          type: "payment_failure",
          title: `Payment Failed for Order #${orderData.orderNumber}`,
          message: `Transaction ${targetTxnId} failed for order #${orderData.orderNumber}.`,
          read: false,
          referenceId: targetOrderId,
          referenceType: "order",
          createdAt: nowIso,
        });
      }

      return { duplicate: false, isSuccess, isFailed };
    });

    return NextResponse.json({
      received: true,
      processed: true,
      result,
    });
  } catch (error: any) {
    console.error("Payment webhook error:", error);
    return NextResponse.json({ error: error?.message || "Webhook processing failed" }, { status: 500 });
  }
}
