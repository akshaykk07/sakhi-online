export type PaymentRecordStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded";

export type PaymentGateway = "razorpay" | "stripe" | "cod" | "manual";

export interface PaymentRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerEmail: string;
  method: string;
  status: PaymentRecordStatus;
  transactionId: string;
  amount: number;
  currency: string;
  gateway: PaymentGateway;
  paidAt?: string;
  refundedAmount?: number;
  refundStatus?: "none" | "partial" | "full";
  refundTransactionId?: string;
  gatewayResponse?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface RefundRequestPayload {
  orderId: string;
  amount: number;
  reason: string;
  refundMethod: "gateway" | "manual";
  adminId: string;
  adminName: string;
}
