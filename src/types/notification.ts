export type NotificationType =
  | "new_order"
  | "low_stock"
  | "out_of_stock"
  | "payment_failure"
  | "cancellation"
  | "return_request"
  | "refund_request";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  referenceId?: string; // orderId, productId, etc.
  referenceType?: "order" | "product" | "payment" | "customer";
  createdAt: string;
}
