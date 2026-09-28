export type CouponType = "percentage" | "fixed";

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number; // percentage (e.g. 10 for 10%) or fixed amount (e.g. 150)
  minimumOrderAmount: number;
  maximumDiscount?: number; // caps percentage discount amount
  startDate: string;
  expiryDate: string;
  usageLimit: number; // 0 for unlimited
  usedCount: number;
  perCustomerLimit: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CouponValidationResult {
  valid: boolean;
  coupon?: Coupon;
  discountAmount: number;
  message?: string;
}
