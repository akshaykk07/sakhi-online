"use client";

import React, { useState, useEffect } from "react";
import { orderService } from "@/features/orders/orderService";
import { salesService } from "@/features/sales/salesService";
import { reportService } from "@/features/reports/reportService";
import { Order } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils/cn";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  CategorySalesChart,
  DailySalesChart,
} from "@/components/charts/DashboardCharts";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Calendar,
  Filter,
  DollarSign,
  TrendingUp,
} from "lucide-react";

export default function ReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState("2026-09");
  const [orders, setOrders] = useState<Order[]>([]);
  const [categorySales, setCategorySales] = useState<{ name: string; value: number }[]>([]);
  const [productSales, setProductSales] = useState<{ name: string; units: number; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportData();
  }, [selectedMonth]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const [ordList, cat, prod] = await Promise.all([
        orderService.getOrders({ limit: 500 }),
        salesService.getSalesByCategory(),
        salesService.getSalesByProduct(),
      ]);
      setOrders(ordList);
      setCategorySales(cat);
      setProductSales(prod);
    } catch (e) {
      console.error("Reports load error:", e);
    } finally {
      setLoading(false);
    }
  };

  // Filter orders by month
  const monthlyOrders = orders.filter((o) => (o.createdAt || "").startsWith(selectedMonth));

  let gross = 0;
  let discount = 0;
  let refunds = 0;
  let itemsSold = 0;
  let cancelledCount = 0;
  let returnedCount = 0;

  for (const o of monthlyOrders) {
    if (o.orderStatus === "cancelled") {
      cancelledCount++;
      continue;
    }
    if (o.orderStatus === "returned") {
      returnedCount++;
    }

    gross += o.subtotal || 0;
    discount += o.discount || 0;
    refunds += o.refundAmount || 0;
    itemsSold += o.items?.reduce((s, i) => s + i.quantity, 0) || 0;
  }

  const validCount = monthlyOrders.filter((o) => o.orderStatus !== "cancelled").length;
  const net = Math.max(0, Number((gross - discount - refunds).toFixed(2)));
  const aov = validCount > 0 ? Number((gross / validCount).toFixed(2)) : 0;

  const handleExportCSV = () => {
    const rows = monthlyOrders.map((o) => ({
      OrderNumber: o.orderNumber,
      Date: formatDate(o.createdAt),
      Customer: o.customerSnapshot?.name,
      Gross: o.subtotal,
      Discount: o.discount,
      Tax: o.tax,
      Total: o.total,
      Refunded: o.refundAmount || 0,
      Status: o.orderStatus,
    }));
    reportService.exportToCSV(`Financial_Report_${selectedMonth}`, rows);
  };

  const handleExportExcel = () => {
    const rows = monthlyOrders.map((o) => ({
      "Order Number": o.orderNumber,
      "Order Date": formatDate(o.createdAt),
      Customer: o.customerSnapshot?.name,
      "Gross (₹)": o.subtotal,
      "Discount (₹)": o.discount,
      "Tax (₹)": o.tax,
      "Total (₹)": o.total,
      "Refunded (₹)": o.refundAmount || 0,
      Status: o.orderStatus,
    }));
    reportService.exportToExcel(`Financial_Report_${selectedMonth}`, rows, "Monthly Report");
  };

  const handleExportPDF = () => {
    const headers = ["Order #", "Customer", "Date", "Gross", "Discount", "Total", "Status"];
    const rows = monthlyOrders.map((o) => [
      o.orderNumber,
      o.customerSnapshot?.name || "Customer",
      formatDate(o.createdAt),
      formatCurrency(o.subtotal),
      `-${formatCurrency(o.discount)}`,
      formatCurrency(o.total),
      o.orderStatus,
    ]);

    const summary = [
      { label: "Report Period", value: selectedMonth },
      { label: "Gross Revenue", value: formatCurrency(gross) },
      { label: "Total Discounts", value: `-${formatCurrency(discount)}` },
      { label: "Total Refunds", value: formatCurrency(refunds) },
      { label: "Net Revenue", value: formatCurrency(net) },
      { label: "Total Orders", value: String(monthlyOrders.length) },
      { label: "Products Sold", value: String(itemsSold) },
      { label: "AOV", value: formatCurrency(aov) },
    ];

    reportService.exportToPDF(
      `Monthly Commerce Executive Report - ${selectedMonth}`,
      headers,
      rows,
      `Report_${selectedMonth}`,
      summary
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Executive Commerce Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Accounting statements, monthly performance summaries, and verified exports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print
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
            PDF Report
          </Button>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs max-w-sm">
        <Calendar className="h-4 w-4 text-slate-400" />
        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />
      </div>

      {/* Financial KPIs for selected month */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500">Gross Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">{formatCurrency(gross)}</div>
            <p className="text-[11px] text-slate-500 mt-1">Pre-deductions volume</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500">Net Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-emerald-600">{formatCurrency(net)}</div>
            <p className="text-[11px] text-slate-500 mt-1">Gross minus discounts & refunds</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500">Units Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">{itemsSold} Units</div>
            <p className="text-[11px] text-slate-500 mt-1">Across all order lines</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500">Orders & AOV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">{monthlyOrders.length} Orders</div>
            <p className="text-[11px] text-slate-500 mt-1">AOV: {formatCurrency(aov)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance by Category & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Best-Selling Categories</CardTitle>
            <p className="text-xs text-slate-500">Revenue generation per store division</p>
          </CardHeader>
          <CardContent>
            <CategorySalesChart data={categorySales} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Best-Selling Merchandise</CardTitle>
            <p className="text-xs text-slate-500">Top revenue generating products</p>
          </CardHeader>
          <CardContent>
            {productSales.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No product data recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3 text-center">Units Sold</th>
                      <th className="py-2.5 px-3 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productSales.slice(0, 6).map((ps, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{ps.name}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">{ps.units}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
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
      </div>
    </div>
  );
}
