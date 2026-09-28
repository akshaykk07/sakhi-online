export type InventoryTransactionType =
  | "stock_in"
  | "stock_out"
  | "order"
  | "return"
  | "refund"
  | "damage"
  | "manual_adjustment";

export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  type: InventoryTransactionType;
  quantity: number; // positive for additions, negative for reductions
  previousStock: number;
  newStock: number;
  reason: string;
  referenceId?: string; // orderId, returnId, or adjustmentId
  performedBy: string; // adminId, 'system', or 'customer'
  performedByName: string;
  createdAt: string;
}

export interface StockAdjustmentPayload {
  productId: string;
  type: InventoryTransactionType;
  quantity: number;
  reason: string;
  performedBy: string;
  performedByName: string;
}
