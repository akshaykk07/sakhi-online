import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { canTransitionOrderStatus, getInventoryStatusImpact } from "@/lib/business-rules";
import { OrderStatus } from "@/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await req.json();
    const { newStatus, adminId = "admin", adminName = "Administrator", note = "" } = body;

    if (!newStatus) {
      return NextResponse.json({ error: "Missing newStatus parameter" }, { status: 400 });
    }

    const db = getAdminDb();
    const nowIso = new Date().toISOString();

    const result = await db.runTransaction(async (transaction) => {
      const orderRef = db.collection("orders").doc(orderId);
      const orderSnap = await transaction.get(orderRef);

      if (!orderSnap.exists) {
        throw new Error(`Order #${orderId} not found.`);
      }

      const orderData = orderSnap.data()!;
      const currentStatus: OrderStatus = orderData.orderStatus;

      const transitionCheck = canTransitionOrderStatus(currentStatus, newStatus as OrderStatus);
      if (!transitionCheck.allowed) {
        throw new Error(transitionCheck.reason || "Invalid status transition.");
      }

      // Check inventory restoration impact
      const inventoryImpact = getInventoryStatusImpact(currentStatus, newStatus as OrderStatus);
      if (inventoryImpact === "restore" && orderData.items && orderData.items.length > 0) {
        for (const item of orderData.items) {
          const prodRef = db.collection("products").doc(item.productId);
          const prodSnap = await transaction.get(prodRef);

          if (prodSnap.exists) {
            const currentStock = Number(prodSnap.data()?.stockQuantity || 0);
            const restoredStock = currentStock + Number(item.quantity);

            transaction.update(prodRef, {
              stockQuantity: restoredStock,
              updatedAt: nowIso,
            });

            const invTxRef = db.collection("inventoryTransactions").doc();
            transaction.set(invTxRef, {
              id: invTxRef.id,
              productId: item.productId,
              productName: item.name,
              type: newStatus === "refunded" ? "refund" : "return",
              quantity: item.quantity,
              previousStock: currentStock,
              newStock: restoredStock,
              reason: `Order #${orderData.orderNumber} ${newStatus} (${note || "Status update"})`,
              referenceId: orderId,
              performedBy: adminId,
              performedByName: adminName,
              createdAt: nowIso,
            });
          }
        }
      }

      // Build updates for Order
      const updates: Record<string, any> = {
        orderStatus: newStatus,
        updatedAt: nowIso,
      };

      if (newStatus === "delivered") updates.deliveredAt = nowIso;
      if (newStatus === "cancelled") updates.cancelledAt = nowIso;
      if (newStatus === "refunded") updates.refundedAt = nowIso;

      transaction.update(orderRef, updates);

      // Record in subcollection statusHistory
      const historyRef = orderRef.collection("statusHistory").doc();
      transaction.set(historyRef, {
        id: historyRef.id,
        previousStatus: currentStatus,
        newStatus,
        changedBy: adminId,
        changedByName: adminName,
        timestamp: nowIso,
        note: note || `Status transitioned from ${currentStatus} to ${newStatus}`,
      });

      // Audit Log
      const auditRef = db.collection("auditLogs").doc();
      transaction.set(auditRef, {
        id: auditRef.id,
        adminId,
        adminName,
        action: "ORDER_STATUS_UPDATE",
        collection: "orders",
        documentId: orderId,
        previousValue: { orderStatus: currentStatus },
        newValue: { orderStatus: newStatus },
        timestamp: nowIso,
        metadata: {
          orderNumber: orderData.orderNumber,
          note,
          inventoryRestored: inventoryImpact === "restore",
        },
      });

      return {
        previousStatus: currentStatus,
        newStatus,
        orderNumber: orderData.orderNumber,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Order #${result.orderNumber} successfully updated to ${result.newStatus}.`,
      ...result,
    });
  } catch (error: any) {
    console.error("Order status update API error:", error);
    return NextResponse.json({ error: error?.message || "Failed to update order status." }, { status: 500 });
  }
}
