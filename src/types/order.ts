export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned"
  | "refunded";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded";

export type PaymentMethod = "card" | "upi" | "netbanking" | "cod" | "wallet";

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  image: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  discount: number;
  tax: number;
  subtotal: number;
  variantId?: string;
  variantName?: string;
}

export interface CustomerSnapshot {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  notes?: string;
}

export interface OrderStatusHistory {
  id: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  changedBy: string;
  changedByName: string;
  timestamp: string;
  note?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerSnapshot: CustomerSnapshot;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  deliveryCharge: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionId?: string;
  orderStatus: OrderStatus;
  couponId?: string;
  couponCode?: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  cancelledAt?: string;
  refundedAt?: string;
  cancellationReason?: string;
  refundAmount?: number;
}

export interface CreateOrderPayload {
  customerId?: string;
  customerSnapshot: CustomerSnapshot;
  items: {
    productId: string;
    variantId?: string;
    quantity: number;
  }[];
  couponCode?: string;
  paymentMethod: PaymentMethod;
  deliveryChargeOverride?: number;
}
