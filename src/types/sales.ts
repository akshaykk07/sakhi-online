export type SalesPeriod = "daily" | "monthly" | "yearly";

export interface SalesAggregate {
  id: string; // e.g. "2026-09-28", "2026-09", "2026"
  period: SalesPeriod;
  periodKey: string;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  taxes: number;
  deliveryCharges: number;
  orderCount: number;
  itemsSold: number;
  costOfGoodsSold: number;
  profit: number;
  averageOrderValue: number;
  updatedAt: string;
}

export interface DashboardMetrics {
  totalSales: number;
  todaySales: number;
  thisWeekSales: number;
  thisMonthSales: number;
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  refundedOrders: number;
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalCustomers: number;
  revenue: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  costOfGoodsSold: number;
  profit: number;
  averageOrderValue: number;
}
