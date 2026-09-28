"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { salesService } from "@/features/sales/salesService";
import { orderService } from "@/features/orders/orderService";
import { DashboardMetrics, Order, SalesAggregate } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils/cn";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/Badge";
import {
  DailySalesChart,
  OrderDistributionChart,
  CategorySalesChart,
  RevenueVsRefundsChart,
} from "@/components/charts/DashboardCharts";
import {
  TrendingUp,
  ShoppingBag,
  Package,
  Users,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Plus,
  ExternalLink,
  DollarSign,
  Receipt,
  Percent,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [dailySales, setDailySales] = useState<SalesAggregate[]>([]);
  const [categorySales, setCategorySales] = useState<{ name: string; value: number }[]>([]);
  const [productSales, setProductSales] = useState<{ name: string; units: number; revenue: number }[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [m, daily, cat, prod, orders] = await Promise.all([
        salesService.getDashboardMetrics(),
        salesService.getDailySales(14),
        salesService.getSalesByCategory(),
        salesService.getSalesByProduct(),
        orderService.getOrders({ limit: 8 }),
      ]);
      setMetrics(m);
      setDailySales(daily);
      setCategorySales(cat);
      setProductSales(prod);
      setRecentOrders(orders);
    } catch (e) {
      console.error("Dashboard data load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const orderDistributionData = metrics
    ? [
        { name: "Pending", value: metrics.pendingOrders },
        { name: "Confirmed", value: metrics.confirmedOrders },
        { name: "Processing", value: metrics.processingOrders },
        { name: "Shipped", value: metrics.shippedOrders },
        { name: "Delivered", value: metrics.deliveredOrders },
        { name: "Cancelled", value: metrics.cancelledOrders },
        { name: "Returned", value: metrics.returnedOrders },
        { name: "Refunded", value: metrics.refundedOrders },
      ]
    : [];

  const comparisonData = dailySales.slice(-6).map((d) => ({
    month: d.periodKey.slice(5),
    revenue: d.netSales || 0,
    refunds: d.refunds || 0,
  }));

  return (
    <div className="space-y-8">
      {/* Top Header / Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Commerce Operations Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time autonomous sales, order processing, and inventory metrics
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={loadDashboardData} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Link href="/admin/products/new">
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Product
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Sales Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Net Sales */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Net Sales
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {metrics ? formatCurrency(metrics.netSales) : "..."}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span>Gross: {metrics ? formatCurrency(metrics.grossSales) : "..."}</span>
              <span>•</span>
              <span className="text-rose-600">Discounts: {metrics ? formatCurrency(metrics.discounts) : "..."}</span>
            </p>
          </CardContent>
        </Card>

        {/* Today's Sales */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Today&apos;s Sales
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {metrics ? formatCurrency(metrics.todaySales) : "..."}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              This Week: {metrics ? formatCurrency(metrics.thisWeekSales) : "..."} • Month: {metrics ? formatCurrency(metrics.thisMonthSales) : "..."}
            </p>
          </CardContent>
        </Card>

        {/* Total Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Orders
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {metrics ? metrics.totalOrders : "..."}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-amber-600 font-medium">{metrics?.pendingOrders} Pending</span>
              <span>•</span>
              <span className="text-blue-600 font-medium">{metrics?.processingOrders} Processing</span>
              <span>•</span>
              <span className="text-emerald-600 font-medium">{metrics?.deliveredOrders} Delivered</span>
            </p>
          </CardContent>
        </Card>

        {/* Profit & Average Order Value */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Profit & AOV
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
              <Receipt className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {metrics ? formatCurrency(metrics.profit) : "..."}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Average Order Value: <span className="font-semibold">{metrics ? formatCurrency(metrics.averageOrderValue) : "..."}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Operational Indicators: Inventory, Customers, Refunds */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Total Products</span>
            <Package className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1">{metrics?.totalProducts || 0}</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-800 font-medium">Low Stock Alerts</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-xl font-bold text-amber-900 mt-1">{metrics?.lowStockProducts || 0}</p>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-rose-800 font-medium">Out of Stock</span>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <p className="text-xl font-bold text-rose-900 mt-1">{metrics?.outOfStockProducts || 0}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Active Customers</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1">{metrics?.totalCustomers || 0}</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Sales Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-base">Daily Net Sales Trend</CardTitle>
              <p className="text-xs text-slate-500">Autonomous sales aggregates from live orders</p>
            </div>
            <Link href="/admin/sales" className="text-xs font-semibold text-indigo-600 hover:underline">
              View Sales
            </Link>
          </CardHeader>
          <CardContent>
            <DailySalesChart data={dailySales} />
          </CardContent>
        </Card>

        {/* Order Status Distribution */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Order Status Distribution</CardTitle>
            <p className="text-xs text-slate-500">Current active lifecycle breakdown</p>
          </CardHeader>
          <CardContent>
            <OrderDistributionChart data={orderDistributionData} />
          </CardContent>
        </Card>
      </div>

      {/* Secondary Charts: Category Revenue & Refunds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by Category</CardTitle>
            <p className="text-xs text-slate-500">Aggregated sales performance per merchandise line</p>
          </CardHeader>
          <CardContent>
            <CategorySalesChart data={categorySales} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue vs Refunds</CardTitle>
            <p className="text-xs text-slate-500">Accounting adjustment tracking</p>
          </CardHeader>
          <CardContent>
            <RevenueVsRefundsChart data={comparisonData} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent Customer Orders</CardTitle>
            <p className="text-xs text-slate-500">Latest orders automated through the system</p>
          </div>
          <Link href="/admin/orders">
            <Button variant="outline" size="sm">
              View All Orders
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No orders placed yet. Visit the{" "}
              <Link href="/store" target="_blank" className="text-indigo-600 font-semibold underline">
                Storefront
              </Link>{" "}
              to place a test order!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <th className="py-2.5 px-3">Order Number</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Payment</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 font-mono font-semibold text-slate-900">
                        {ord.orderNumber}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-medium text-slate-900 block">{ord.customerSnapshot?.name}</span>
                        <span className="text-[11px] text-slate-500 block">{ord.customerSnapshot?.email}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{formatDate(ord.createdAt)}</td>
                      <td className="py-3 px-3">
                        <OrderStatusBadge status={ord.orderStatus} />
                      </td>
                      <td className="py-3 px-3">
                        <PaymentStatusBadge status={ord.paymentStatus} />
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(ord.total)}
                      </td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <Link
                          href={`/admin/orders/${ord.id}`}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          Manage
                        </Link>
                        <Link
                          href={`/invoice/${ord.id}`}
                          target="_blank"
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                        >
                          Invoice
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
