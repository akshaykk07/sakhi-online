"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { salesService } from "@/features/sales/salesService";
import { orderService } from "@/features/orders/orderService";
import { reportService } from "@/features/reports/reportService";
import { SalesAggregate, Order } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils/cn";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/Badge";
import { DailySalesChart, CategorySalesChart } from "@/components/charts/DashboardCharts";
import { AddSaleModal } from "@/features/sales/components/AddSaleModal";
import {
  TrendingUp,
  Download,
  FileSpreadsheet,
  FileText,
  DollarSign,
  Percent,
  RotateCcw,
  ShoppingBag,
  Calendar,
  Filter,
  Plus,
  RefreshCw,
  Receipt,
  Eye,
  ExternalLink,
} from "lucide-react";

export default function SalesPage() {
  const [filterPeriod, setFilterPeriod] = useState<"today" | "yesterday" | "week" | "month" | "last_month" | "year" | "all">("month");
  const [orders, setOrders] = useState<Order[]>([]);
  const [dailySales, setDailySales] = useState<SalesAggregate[]>([]);
  const [categorySales, setCategorySales] = useState<{ name: string; value: number }[]>([]);
  const [productSales, setProductSales] = useState<{ name: string; units: number; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddSaleOpen, setIsAddSaleOpen] = useState(false);

  useEffect(() => {
    loadSalesData();
  }, [filterPeriod]);

  const loadSalesData = async () => {
    setLoading(true);
    try {
      const [ordList, daily, cat, prod] = await Promise.all([
        orderService.getOrders({ limit: 300 }),
        salesService.getDailySales(30),
        salesService.getSalesByCategory(),
        salesService.getSalesByProduct(),
      ]);
      setOrders(ordList);
      setDailySales(daily);
      setCategorySales(cat);
      setProductSales(prod);
    } catch (e) {
      console.error("Sales data error:", e);
    } finally {
      setLoading(false);
    }
  };

  // Filter orders according to selected period
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const monthStr = now.toISOString().slice(0, 7);

  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = lastMonth.toISOString().slice(0, 7);

  const yearStr = now.toISOString().slice(0, 4);

  const filteredOrders = orders.filter((o) => {
    if (o.orderStatus === "cancelled") return false;
    const d = (o.createdAt || "").slice(0, 10);

    switch (filterPeriod) {
      case "today":
        return d === todayStr;
      case "yesterday":
        return d === yesterdayStr;
      case "week":
        return d >= weekStartStr;
      case "month":
        return d.startsWith(monthStr);
      case "last_month":
        return d.startsWith(lastMonthStr);
      case "year":
        return d.startsWith(yearStr);
      default:
        return true;
    }
  });

  // Calculate metrics
  let grossSales = 0;
  let discounts = 0;
  let refunds = 0;
  let itemsSold = 0;

  for (const o of filteredOrders) {
    grossSales += o.subtotal || 0;
    discounts += o.discount || 0;
    refunds += o.refundAmount || 0;
    itemsSold += o.items?.reduce((s, i) => s + i.quantity, 0) || 0;
  }

  const netSales = Math.max(0, Number((grossSales - discounts - refunds).toFixed(2)));
  const aov = filteredOrders.length > 0 ? Number((grossSales / filteredOrders.length).toFixed(2)) : 0;

  // Exports
  const handleExportCSV = () => {
    const rows = filteredOrders.map((o) => ({
      OrderNumber: o.orderNumber,
      Date: formatDate(o.createdAt),
      Customer: o.customerSnapshot?.name,
      Email: o.customerSnapshot?.email,
      Subtotal: o.subtotal,
      Discount: o.discount,
      Tax: o.tax,
      Delivery: o.deliveryCharge,
      Total: o.total,
      Refunded: o.refundAmount || 0,
      Status: o.orderStatus,
      PaymentStatus: o.paymentStatus,
    }));
    reportService.exportToCSV(`Sales_Report_${filterPeriod}`, rows);
  };

  const handleExportExcel = () => {
    const rows = filteredOrders.map((o) => ({
      "Order Number": o.orderNumber,
      "Order Date": formatDate(o.createdAt),
      "Customer Name": o.customerSnapshot?.name,
      "Customer Email": o.customerSnapshot?.email,
      "Subtotal (₹)": o.subtotal,
      "Discount (₹)": o.discount,
      "Tax (₹)": o.tax,
      "Delivery Charge (₹)": o.deliveryCharge,
      "Total Amount (₹)": o.total,
      "Refunded (₹)": o.refundAmount || 0,
      "Order Status": o.orderStatus,
      "Payment Status": o.paymentStatus,
    }));
    reportService.exportToExcel(`Sales_Report_${filterPeriod}`, rows, "Sales");
  };

  const handleExportPDF = () => {
    const headers = ["Order #", "Customer", "Date", "Gross", "Discount", "Refund", "Net Total"];
    const rows = filteredOrders.map((o) => [
      o.orderNumber,
      o.customerSnapshot?.name || "Customer",
      formatDate(o.createdAt),
      formatCurrency(o.subtotal),
      `-${formatCurrency(o.discount)}`,
      formatCurrency(o.refundAmount || 0),
      formatCurrency(o.total),
    ]);

    const summary = [
      { label: "Gross Sales", value: formatCurrency(grossSales) },
      { label: "Total Discounts", value: `-${formatCurrency(discounts)}` },
      { label: "Total Refunds", value: formatCurrency(refunds) },
      { label: "Net Sales", value: formatCurrency(netSales) },
      { label: "Orders Count", value: String(filteredOrders.length) },
      { label: "Average Order Value", value: formatCurrency(aov) },
    ];

    reportService.exportToPDF(
      `Sales Ledger Report (${filterPeriod.replace("_", " ").toUpperCase()})`,
      headers,
      rows,
      `Sales_${filterPeriod}`,
      summary
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Export Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sales Intelligence & Ledger</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated financial revenue aggregation, accounting deductions, and downloads
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsAddSaleOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Sale
          </Button>

          <Button variant="outline" size="sm" onClick={loadSalesData} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            Excel
          </Button>
          <Button size="sm" onClick={handleExportPDF} className="bg-slate-900">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Date Filter Selection Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: "today", label: "Today" },
          { id: "yesterday", label: "Yesterday" },
          { id: "week", label: "This Week" },
          { id: "month", label: "This Month" },
          { id: "last_month", label: "Last Month" },
          { id: "year", label: "This Year" },
          { id: "all", label: "All Time" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilterPeriod(t.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              filterPeriod === t.id
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500">Gross Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">{formatCurrency(grossSales)}</div>
            <p className="text-[11px] text-slate-500 mt-1">Pre-discount order subtotal sum</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500">Net Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-emerald-600">{formatCurrency(netSales)}</div>
            <p className="text-[11px] text-slate-500 mt-1">Gross minus discounts & refunds</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500">Discounts & Refunds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-slate-900">
              <span className="text-amber-600">-{formatCurrency(discounts)}</span>
              <span className="text-slate-300 mx-1.5">•</span>
              <span className="text-rose-600">-{formatCurrency(refunds)}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Promotional savings & refund adjustments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500">Orders & AOV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">{filteredOrders.length} Orders</div>
            <p className="text-[11px] text-slate-500 mt-1">
              AOV: <span className="font-semibold text-slate-800">{formatCurrency(aov)}</span> • {itemsSold} Items
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Sales Aggregates</CardTitle>
            <p className="text-xs text-slate-500">Aggregated from Firestore salesDaily records</p>
          </CardHeader>
          <CardContent>
            <DailySalesChart data={dailySales} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category Performance</CardTitle>
            <p className="text-xs text-slate-500">Revenue contribution per category</p>
          </CardHeader>
          <CardContent>
            <CategorySalesChart data={categorySales} />
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Product Sales Breakdown</CardTitle>
          <p className="text-xs text-slate-500">Units sold and gross revenue contribution by merchandise item</p>
        </CardHeader>
        <CardContent>
          {productSales.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No product sales recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3 text-center">Units Sold</th>
                    <th className="py-2.5 px-3 text-right">Revenue Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productSales.map((ps, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-semibold text-slate-900">{ps.name}</td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">{ps.units}</td>
                      <td className="py-3 px-3 text-right font-extrabold text-slate-900">
                        {formatCurrency(ps.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales Transactions & Orders Ledger */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div>
            <CardTitle className="text-base">Sales Transactions & Orders</CardTitle>
            <p className="text-xs text-slate-500">
              Individual order receipts, line items, and payment settlements for {filterPeriod.replace("_", " ")}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setIsAddSaleOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Record Direct Sale
          </Button>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No sales orders found for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <th className="py-2.5 px-3">Order #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3 text-center">Payment</th>
                    <th className="py-2.5 px-3 text-center">Order Status</th>
                    <th className="py-2.5 px-3 text-right">Gross</th>
                    <th className="py-2.5 px-3 text-right">Net Amount</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.slice(0, 20).map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-semibold font-mono text-indigo-600">
                        {o.orderNumber}
                      </td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        {formatDate(o.createdAt)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{o.customerSnapshot?.name || "Customer"}</div>
                        <div className="text-[10px] text-slate-400">{o.customerSnapshot?.phone || o.customerSnapshot?.email}</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase text-slate-600 block">
                            {o.paymentMethod}
                          </span>
                          <PaymentStatusBadge status={o.paymentStatus} />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <OrderStatusBadge status={o.orderStatus} />
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {formatCurrency(o.subtotal)}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-slate-900">
                        {formatCurrency(o.total)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link href={`/invoice/${o.id}`} target="_blank" title="View & Print Invoice">
                            <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1">
                              <Receipt className="h-3 w-3 text-indigo-600" />
                              Invoice
                            </Button>
                          </Link>
                          <Link href={`/admin/orders/${o.id}`} title="View Order Details">
                            <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1">
                              <Eye className="h-3 w-3" />
                              View
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredOrders.length > 20 && (
                <div className="pt-3 text-center text-xs text-slate-400">
                  Showing 20 of {filteredOrders.length} orders. Use Order Management to view all records.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Sale Modal */}
      <AddSaleModal
        isOpen={isAddSaleOpen}
        onClose={() => setIsAddSaleOpen(false)}
        onSaleCreated={loadSalesData}
      />
    </div>
  );
}
