"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { orderService } from "@/features/orders/orderService";
import { settingsService } from "@/features/settings/settingsService";
import { reportService } from "@/features/reports/reportService";
import { Order, BusinessSettings, DEFAULT_BUSINESS_SETTINGS } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/Badge";
import { Printer, Download, ArrowLeft, Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!orderId) return;
      try {
        const [ord, sett] = await Promise.all([
          orderService.getOrder(orderId),
          settingsService.getSettings(),
        ]);
        setOrder(ord);
        if (sett) setSettings(sett);
      } catch (e) {
        console.error("Failed to load invoice:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [orderId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    if (!order) return;

    const headers = ["Item", "SKU", "Qty", "Unit Price", "Tax", "Subtotal"];
    const rows = order.items.map((item) => [
      item.name + (item.variantName ? ` (${item.variantName})` : ""),
      item.sku,
      item.quantity,
      formatCurrency(item.unitPrice),
      formatCurrency(item.tax),
      formatCurrency(item.subtotal),
    ]);

    const summary = [
      { label: "Subtotal", value: formatCurrency(order.subtotal) },
      { label: "Discount", value: `-${formatCurrency(order.discount)}` },
      { label: "Tax", value: formatCurrency(order.tax) },
      { label: "Delivery", value: formatCurrency(order.deliveryCharge) },
      { label: "Grand Total", value: formatCurrency(order.total) },
    ];

    reportService.exportToPDF(
      `Tax Invoice - #${order.orderNumber}`,
      headers,
      rows,
      `Invoice_${order.orderNumber}`,
      summary
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-slate-800" />
          <p className="text-xs text-slate-500">Generating immutable tax invoice...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-slate-900">Invoice Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">Order #{orderId} does not exist.</p>
        <Button onClick={() => router.back()} className="mt-4" size="sm">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 print:p-0 print:bg-white text-slate-900">
      {/* Top Action Bar */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Button>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-1.5 h-4 w-4" />
            Print Invoice
          </Button>
          <Button size="sm" onClick={handleDownloadPDF} className="bg-slate-900">
            <Download className="mr-1.5 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Invoice Document Paper */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-8 sm:p-12 print:shadow-none print:border-none print:p-6 space-y-8">
        {/* Header & Seller Info */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-slate-900 text-white font-bold flex items-center justify-center text-sm">
                E
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                {settings.businessName}
              </h1>
            </div>
            <p className="text-xs text-slate-600 max-w-xs">{settings.address}</p>
            <p className="text-xs text-slate-600 mt-1">Phone: {settings.phone}</p>
            <p className="text-xs text-slate-600">Email: {settings.email}</p>
            <p className="text-xs font-semibold text-slate-700 mt-1">
              GSTIN / Tax ID: <span className="font-mono">{settings.gstNumber}</span>
            </p>
          </div>

          <div className="text-left sm:text-right space-y-1">
            <span className="inline-block rounded-md bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-800">
              Tax Invoice
            </span>
            <h3 className="text-lg font-mono font-bold text-slate-900">#{order.orderNumber}</h3>
            <p className="text-xs text-slate-500">Invoice Date: {formatDate(order.createdAt)}</p>
            <div className="pt-2 flex flex-col sm:items-end gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Order:</span>
                <OrderStatusBadge status={order.orderStatus} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Payment:</span>
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
            </div>
          </div>
        </div>

        {/* Customer / Billed To */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-slate-200 text-xs">
          <div className="space-y-1">
            <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Billed & Shipped To:
            </span>
            <p className="font-bold text-sm text-slate-900">{order.customerSnapshot?.name}</p>
            <p className="text-slate-600">{order.customerSnapshot?.address}</p>
            <p className="text-slate-600">
              {order.customerSnapshot?.city}, {order.customerSnapshot?.state} - {order.customerSnapshot?.pinCode}
            </p>
            <p className="text-slate-600">Phone: {order.customerSnapshot?.phone}</p>
            <p className="text-slate-600">Email: {order.customerSnapshot?.email}</p>
          </div>

          <div className="space-y-1 sm:text-right">
            <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Payment Details:
            </span>
            <p className="text-slate-700">
              Method: <span className="font-semibold uppercase">{order.paymentMethod}</span>
            </p>
            <p className="text-slate-700">
              Transaction ID: <span className="font-mono font-semibold">{order.transactionId || "N/A"}</span>
            </p>
            {order.couponCode && (
              <p className="text-emerald-700 font-semibold">
                Coupon Applied: {order.couponCode}
              </p>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 uppercase font-semibold">
                <th className="py-3 px-3">Item Description</th>
                <th className="py-3 px-3">SKU</th>
                <th className="py-3 px-3 text-center">Qty</th>
                <th className="py-3 px-3 text-right">Unit Price</th>
                <th className="py-3 px-3 text-right">Tax (GST)</th>
                <th className="py-3 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-3 px-3 font-medium text-slate-900">
                    {item.name}
                    {item.variantName && (
                      <span className="block text-[10px] text-slate-500 font-normal">
                        Variant: {item.variantName}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-500 font-mono">{item.sku}</td>
                  <td className="py-3 px-3 text-center font-semibold">{item.quantity}</td>
                  <td className="py-3 px-3 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-3 px-3 text-right">{formatCurrency(item.tax)}</td>
                  <td className="py-3 px-3 text-right font-bold">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start pt-4 border-t border-slate-200 gap-6">
          <div className="text-xs text-slate-500 max-w-sm space-y-1">
            <p className="font-semibold text-slate-700">Terms & Conditions:</p>
            <p>1. Invoices are computer generated and tamper-evident based on atomic order snapshots.</p>
            <p>2. Goods once sold can be returned within 7 days in accordance with the return policy.</p>
          </div>

          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-medium">{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Discount:</span>
                <span>-{formatCurrency(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Estimated Taxes (GST):</span>
              <span className="font-medium">{formatCurrency(order.tax)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery Charge:</span>
              <span className="font-medium">
                {order.deliveryCharge === 0 ? "FREE" : formatCurrency(order.deliveryCharge)}
              </span>
            </div>
            <div className="flex justify-between text-slate-900 font-extrabold text-base pt-2 border-t-2 border-slate-900">
              <span>Final Amount:</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="pt-6 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Verified Autonomous Commerce Snapshot
          </span>
          <span>Thank you for your business!</span>
        </div>
      </div>
    </div>
  );
}
