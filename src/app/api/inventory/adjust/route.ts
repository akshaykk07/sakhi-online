import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { InventoryTransactionType } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      productId,
      type,
      quantity,
      reason,
      adminId = "admin",
      adminName = "Administrator",
    } = body;

    const delta = Number(quantity);
    if (!productId || isNaN(delta) || delta === 0) {
      return NextResponse.json({ error: "Invalid product or quantity" }, { status: 400 });
    }

    const validTypes: InventoryTransactionType[] = [
      "stock_in",
      "stock_out",
      "manual_adjustment",
      "damage",
      "return",
      "refund",
    ];

    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `Invalid transaction type: ${type}` }, { status: 400 });
    }

    const db = getAdminDb();
    const nowIso = new Date().toISOString();

    const result = await db.runTransaction(async (transaction) => {
      const prodRef = db.collection("products").doc(productId);
      const prodSnap = await transaction.get(prodRef);

      if (!prodSnap.exists) {
        throw new Error(`Product ${productId} not found.`);
      }

      const prodData = prodSnap.data()!;
      const previousStock = Number(prodData.stockQuantity || 0);
      const newStock = previousStock + delta;

      if (newStock < 0) {
        throw new Error(
          `Adjustment of ${delta} would result in negative stock. Current stock: ${previousStock}.`
        );
      }

      // Update Product
      transaction.update(prodRef, {
        stockQuantity: newStock,
        updatedAt: nowIso,
      });

      // Create Ledger Entry
      const invTxRef = db.collection("inventoryTransactions").doc();
      transaction.set(invTxRef, {
        id: invTxRef.id,
        productId,
        productName: prodData.name,
        type,
        quantity: delta,
        previousStock,
        newStock,
        reason: reason || `Manual adjustment (${type})`,
        referenceId: invTxRef.id,
        performedBy: adminId,
        performedByName: adminName,
        createdAt: nowIso,
      });

      // Audit Log
      const auditRef = db.collection("auditLogs").doc();
      transaction.set(auditRef, {
        id: auditRef.id,
        adminId,
        adminName,
        action: "INVENTORY_ADJUSTMENT",
        collection: "products",
        documentId: productId,
        previousValue: { stockQuantity: previousStock },
        newValue: { stockQuantity: newStock },
        timestamp: nowIso,
        metadata: {
          productName: prodData.name,
          adjustmentType: type,
          quantityDelta: delta,
          reason,
        },
      });

      return {
        productName: prodData.name,
        previousStock,
        newStock,
        transactionId: invTxRef.id,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Inventory updated for ${result.productName}. New stock: ${result.newStock}`,
      ...result,
    });
  } catch (error: any) {
    console.error("Inventory adjustment API error:", error);
    return NextResponse.json({ error: error?.message || "Failed to adjust inventory." }, { status: 500 });
  }
}
