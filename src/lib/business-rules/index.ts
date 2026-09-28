import {
  OrderStatus,
  PaymentStatus,
  Coupon,
  CouponValidationResult,
  BusinessSettings,
  DEFAULT_BUSINESS_SETTINGS,
} from "@/types";

export interface CalculatedOrderTotals {
  subtotal: number;
  itemDiscounts: number;
  couponDiscount: number;
  totalDiscount: number;
  taxableAmount: number;
  tax: number;
  deliveryCharge: number;
  total: number;
  totalCostPrice: number;
  totalQuantity: number;
}

export interface OrderItemCalculationInput {
  unitPrice: number;
  costPrice?: number;
  quantity: number;
  discount?: number;
}

/**
 * Calculates tax on a given taxable amount based on tax percentage rate.
 * Rounds to 2 decimal places.
 */
export function calculateTax(taxableAmount: number, taxRatePercentage: number): number {
  if (taxableAmount <= 0 || taxRatePercentage <= 0) return 0;
  return Number(((taxableAmount * taxRatePercentage) / 100).toFixed(2));
}

/**
 * Calculates delivery charges based on business rules and free delivery threshold.
 */
export function calculateDeliveryCharge(
  subtotalAfterDiscount: number,
  baseCharge: number = DEFAULT_BUSINESS_SETTINGS.deliveryCharge,
  freeDeliveryThreshold: number = DEFAULT_BUSINESS_SETTINGS.freeDeliveryThreshold
): number {
  if (subtotalAfterDiscount <= 0) return 0;
  if (freeDeliveryThreshold > 0 && subtotalAfterDiscount >= freeDeliveryThreshold) {
    return 0;
  }
  return Number(Math.max(0, baseCharge).toFixed(2));
}

/**
 * Validates a coupon against cart subtotal, usage count, dates, and calculates discount amount.
 */
export function validateAndCalculateCoupon(
  coupon: Coupon | null | undefined,
  subtotal: number,
  customerUsageCount: number = 0,
  referenceDate: Date = new Date()
): CouponValidationResult {
  if (!coupon) {
    return { valid: false, discountAmount: 0, message: "Coupon does not exist" };
  }

  if (!coupon.active) {
    return { valid: false, discountAmount: 0, message: "This coupon is currently inactive" };
  }

  const nowTime = referenceDate.getTime();
  const startTime = new Date(coupon.startDate).getTime();
  const expiryTime = new Date(coupon.expiryDate).getTime();

  if (nowTime < startTime) {
    return { valid: false, discountAmount: 0, message: "This coupon promotion has not started yet" };
  }

  if (nowTime > expiryTime) {
    return { valid: false, discountAmount: 0, message: "This coupon has expired" };
  }

  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, discountAmount: 0, message: "Coupon usage limit has been reached" };
  }

  if (coupon.perCustomerLimit > 0 && customerUsageCount >= coupon.perCustomerLimit) {
    return {
      valid: false,
      discountAmount: 0,
      message: `You have reached the limit of ${coupon.perCustomerLimit} use(s) for this coupon`,
    };
  }

  if (coupon.minimumOrderAmount > 0 && subtotal < coupon.minimumOrderAmount) {
    return {
      valid: false,
      discountAmount: 0,
      message: `Minimum order amount for this coupon is ₹${coupon.minimumOrderAmount}`,
    };
  }

  let calculatedDiscount = 0;
  if (coupon.type === "percentage") {
    calculatedDiscount = (subtotal * coupon.value) / 100;
    if (coupon.maximumDiscount && coupon.maximumDiscount > 0) {
      calculatedDiscount = Math.min(calculatedDiscount, coupon.maximumDiscount);
    }
  } else if (coupon.type === "fixed") {
    calculatedDiscount = Math.min(coupon.value, subtotal);
  }

  calculatedDiscount = Number(Math.max(0, calculatedDiscount).toFixed(2));

  return {
    valid: true,
    coupon,
    discountAmount: calculatedDiscount,
  };
}

/**
 * Calculates complete order financials server-side or client-side using immutable business rules.
 */
export function calculateOrderFinancials(
  items: OrderItemCalculationInput[],
  coupon?: Coupon | null,
  customerUsageCount: number = 0,
  settings: Partial<BusinessSettings> = DEFAULT_BUSINESS_SETTINGS
): CalculatedOrderTotals {
  let subtotal = 0;
  let itemDiscounts = 0;
  let totalCostPrice = 0;
  let totalQuantity = 0;

  for (const item of items) {
    const qty = Math.max(1, Math.floor(item.quantity));
    const price = Math.max(0, item.unitPrice);
    const cost = Math.max(0, item.costPrice || 0);
    const itemDiscount = Math.max(0, item.discount || 0);

    subtotal += price * qty;
    itemDiscounts += itemDiscount * qty;
    totalCostPrice += cost * qty;
    totalQuantity += qty;
  }

  subtotal = Number(subtotal.toFixed(2));
  itemDiscounts = Number(itemDiscounts.toFixed(2));

  // Calculate coupon discount
  let couponDiscount = 0;
  if (coupon) {
    const couponResult = validateAndCalculateCoupon(coupon, subtotal - itemDiscounts, customerUsageCount);
    if (couponResult.valid) {
      couponDiscount = couponResult.discountAmount;
    }
  }

  const totalDiscount = Number((itemDiscounts + couponDiscount).toFixed(2));
  const taxableAmount = Math.max(0, Number((subtotal - totalDiscount).toFixed(2)));

  const taxRate = settings.defaultTaxRate !== undefined ? settings.defaultTaxRate : DEFAULT_BUSINESS_SETTINGS.defaultTaxRate;
  const tax = calculateTax(taxableAmount, taxRate);

  const deliveryCharge = calculateDeliveryCharge(
    taxableAmount,
    settings.deliveryCharge,
    settings.freeDeliveryThreshold
  );

  const total = Number((taxableAmount + tax + deliveryCharge).toFixed(2));

  return {
    subtotal,
    itemDiscounts,
    couponDiscount,
    totalDiscount,
    taxableAmount,
    tax,
    deliveryCharge,
    total,
    totalCostPrice: Number(totalCostPrice.toFixed(2)),
    totalQuantity,
  };
}

/**
 * Validates Order Status Transitions according to business state machine.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "returned", "cancelled"],
  delivered: ["returned", "refunded"],
  cancelled: [], // Terminal
  returned: ["refunded"],
  refunded: [], // Terminal
};

export function canTransitionOrderStatus(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
): { allowed: boolean; reason?: string; requiresConfirmation: boolean } {
  if (currentStatus === newStatus) {
    return { allowed: false, reason: `Order is already in '${currentStatus}' status`, requiresConfirmation: false };
  }

  const allowedNext = ORDER_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(newStatus)) {
    return {
      allowed: false,
      reason: `Cannot transition order status from '${currentStatus}' to '${newStatus}'. Allowed transitions: ${allowedNext.join(", ") || "None (terminal state)"}`,
      requiresConfirmation: false,
    };
  }

  const requiresConfirmation = ["cancelled", "returned", "refunded"].includes(newStatus);
  return { allowed: true, requiresConfirmation };
}

/**
 * Determines whether inventory should be restored when an order changes status.
 */
export function getInventoryStatusImpact(
  previousStatus: OrderStatus,
  newStatus: OrderStatus
): "restore" | "reduce" | "none" {
  const terminalRestoringStatuses: OrderStatus[] = ["cancelled", "returned", "refunded"];
  const activeStatuses: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered"];

  if (activeStatuses.includes(previousStatus) && terminalRestoringStatuses.includes(newStatus)) {
    return "restore";
  }

  return "none";
}
