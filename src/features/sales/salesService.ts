import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { firestoreDb } from "@/lib/firebase/client";
import { SalesAggregate, DashboardMetrics, Order, Product, CreateOrderPayload } from "@/types";
import { orderService } from "@/features/orders/orderService";

export const salesService = {
  async getDailySales(days: number = 30): Promise<SalesAggregate[]> {
    if (!firestoreDb) return [];
    try {
      const colRef = collection(firestoreDb, "salesDaily");
      const q = query(colRef, orderBy("periodKey", "desc"), limit(days));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SalesAggregate));
      return list.sort((a, b) => a.periodKey.localeCompare(b.periodKey));
    } catch {
      try {
        const snap = await getDocs(collection(firestoreDb, "salesDaily"));
        return snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as SalesAggregate))
          .sort((a, b) => a.periodKey.localeCompare(b.periodKey));
      } catch {
        return [];
      }
    }
  },

  async getMonthlySales(months: number = 12): Promise<SalesAggregate[]> {
    if (!firestoreDb) return [];
    try {
      const colRef = collection(firestoreDb, "salesMonthly");
      const q = query(colRef, orderBy("periodKey", "desc"), limit(months));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SalesAggregate));
      return list.sort((a, b) => a.periodKey.localeCompare(b.periodKey));
    } catch {
      try {
        const snap = await getDocs(collection(firestoreDb, "salesMonthly"));
        return snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as SalesAggregate))
          .sort((a, b) => a.periodKey.localeCompare(b.periodKey));
      } catch {
        return [];
      }
    }
  },

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const emptyMetrics: DashboardMetrics = {
      totalSales: 0,
      todaySales: 0,
      thisWeekSales: 0,
      thisMonthSales: 0,
      totalOrders: 0,
      pendingOrders: 0,
      confirmedOrders: 0,
      processingOrders: 0,
      shippedOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      returnedOrders: 0,
      refundedOrders: 0,
      totalProducts: 0,
      lowStockProducts: 0,
      outOfStockProducts: 0,
      totalCustomers: 0,
      revenue: 0,
      grossSales: 0,
      discounts: 0,
      refunds: 0,
      netSales: 0,
      costOfGoodsSold: 0,
      profit: 0,
      averageOrderValue: 0,
    };

    if (!firestoreDb) {
      return emptyMetrics;
    }

    let orders: Order[] = [];
    let products: Product[] = [];
    let customersCount = 0;

    try {
      // Fetch live orders, products, and customers
      const [ordersSnap, prodsSnap, custsSnap] = await Promise.all([
        getDocs(collection(firestoreDb, "orders")),
        getDocs(collection(firestoreDb, "products")),
        getDocs(collection(firestoreDb, "customers")),
      ]);

      orders = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
      products = prodsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
      customersCount = custsSnap.size;
    } catch (e) {
      console.warn("Could not fetch metrics from Firestore (client offline or database not created):", e);
      return emptyMetrics;
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const weekStartStr = startOfWeek.toISOString().slice(0, 10);
    const monthStartStr = now.toISOString().slice(0, 7);

    let grossSales = 0;
    let discounts = 0;
    let refunds = 0;
    let netSales = 0;
    let totalCost = 0;
    let todaySales = 0;
    let thisWeekSales = 0;
    let thisMonthSales = 0;

    let pendingOrders = 0;
    let confirmedOrders = 0;
    let processingOrders = 0;
    let shippedOrders = 0;
    let deliveredOrders = 0;
    let cancelledOrders = 0;
    let returnedOrders = 0;
    let refundedOrders = 0;

    for (const order of orders) {
      const orderDate = (order.createdAt || "").slice(0, 10);
      const isPaidOrValid = !["cancelled"].includes(order.orderStatus);

      if (isPaidOrValid) {
        grossSales += order.subtotal || 0;
        discounts += order.discount || 0;
        refunds += order.refundAmount || 0;

        if (orderDate === todayStr) {
          todaySales += order.total || 0;
        }
        if (orderDate >= weekStartStr) {
          thisWeekSales += order.total || 0;
        }
        if (orderDate.startsWith(monthStartStr)) {
          thisMonthSales += order.total || 0;
        }

        // Sum cost
        if (order.items) {
          for (const item of order.items) {
            totalCost += (item.costPrice || 0) * (item.quantity || 1);
          }
        }
      }

      switch (order.orderStatus) {
        case "pending":
          pendingOrders++;
          break;
        case "confirmed":
          confirmedOrders++;
          break;
        case "processing":
          processingOrders++;
          break;
        case "shipped":
          shippedOrders++;
          break;
        case "delivered":
          deliveredOrders++;
          break;
        case "cancelled":
          cancelledOrders++;
          break;
        case "returned":
          returnedOrders++;
          break;
        case "refunded":
          refundedOrders++;
          break;
      }
    }

    netSales = Math.max(0, Number((grossSales - discounts - refunds).toFixed(2)));
    const validOrderCount = orders.filter((o) => o.orderStatus !== "cancelled").length;
    const aov = validOrderCount > 0 ? Number((grossSales / validOrderCount).toFixed(2)) : 0;
    const profit = Number((netSales - totalCost).toFixed(2));

    let lowStockCount = 0;
    let outOfStockCount = 0;
    for (const p of products) {
      if (p.stockQuantity === 0) outOfStockCount++;
      else if (p.stockQuantity <= (p.lowStockThreshold || 5)) lowStockCount++;
    }

    return {
      totalSales: netSales,
      todaySales: Number(todaySales.toFixed(2)),
      thisWeekSales: Number(thisWeekSales.toFixed(2)),
      thisMonthSales: Number(thisMonthSales.toFixed(2)),
      totalOrders: orders.length,
      pendingOrders,
      confirmedOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      returnedOrders,
      refundedOrders,
      totalProducts: products.length,
      lowStockProducts: lowStockCount,
      outOfStockProducts: outOfStockCount,
      totalCustomers: customersCount,
      revenue: Number((grossSales - discounts).toFixed(2)),
      grossSales: Number(grossSales.toFixed(2)),
      discounts: Number(discounts.toFixed(2)),
      refunds: Number(refunds.toFixed(2)),
      netSales,
      costOfGoodsSold: Number(totalCost.toFixed(2)),
      profit,
      averageOrderValue: aov,
    };
  },

  async getSalesByProduct(): Promise<{ name: string; units: number; revenue: number }[]> {
    if (!firestoreDb) return [];
    try {
      const ordersSnap = await getDocs(collection(firestoreDb, "orders"));
      const map = new Map<string, { name: string; units: number; revenue: number }>();

      ordersSnap.docs.forEach((doc) => {
        const order = doc.data() as Order;
        if (order.orderStatus !== "cancelled" && order.items) {
          order.items.forEach((item) => {
            const key = item.productId || item.name;
            const curr = map.get(key) || { name: item.name, units: 0, revenue: 0 };
            curr.units += item.quantity || 1;
            curr.revenue += item.subtotal || item.unitPrice * (item.quantity || 1);
            map.set(key, curr);
          });
        }
      });

      return Array.from(map.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
    } catch {
      return [];
    }
  },

  async getSalesByCategory(): Promise<{ name: string; value: number }[]> {
    if (!firestoreDb) return [];
    try {
      const [ordersSnap, prodsSnap] = await Promise.all([
        getDocs(collection(firestoreDb, "orders")),
        getDocs(collection(firestoreDb, "products")),
      ]);

      const prodCategoryMap = new Map<string, string>();
      prodsSnap.docs.forEach((d) => {
        const data = d.data();
        prodCategoryMap.set(d.id, data.categoryName || "General");
      });

      const catRevenueMap = new Map<string, number>();
      ordersSnap.docs.forEach((doc) => {
        const order = doc.data() as Order;
        if (order.orderStatus !== "cancelled" && order.items) {
          order.items.forEach((item) => {
            const category = prodCategoryMap.get(item.productId) || "General";
            const rev = item.subtotal || item.unitPrice * (item.quantity || 1);
            catRevenueMap.set(category, (catRevenueMap.get(category) || 0) + rev);
          });
        }
      });

      return Array.from(catRevenueMap.entries()).map(([name, value]) => ({
        name,
        value: Number(value.toFixed(2)),
      }));
    } catch {
      return [];
    }
  },

  /**
   * Records a direct sale executing the complete transactional sales flow
   */
  async recordSale(payload: CreateOrderPayload) {
    return orderService.createCustomerOrder(payload);
  },
};
