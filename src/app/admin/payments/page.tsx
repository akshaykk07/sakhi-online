"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { paymentService } from "@/features/payments/paymentService";
import { PaymentRecord } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils/cn";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { PaymentStatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Select";
import {
  CreditCard,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Webhook Simulator Modal
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [webhookOrderId, setWebhookOrderId] = useState("");
  const [webhookEvent, setWebhookEvent] = useState<"payment.captured" | "payment.failed">("payment.captured");
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<string | null>(null);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const data = await paymentService.getPayments(100);
      setPayments(data);
    } catch (e) {
      console.error("Payments load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookOrderId.trim()) return;
    setSimulating(true);
    setSimResult(null);

    try {
      const res = await paymentService.simulateGatewayWebhook({
        event: webhookEvent,
        orderId: webhookOrderId.trim(),
        transactionId: `GATEWAY-${Date.now().toString().slice(-6)}`,
      });
      setSimResult(JSON.stringify(res, null, 2));
      loadPayments();
    } catch (err: any) {
      setSimResult("Error: " + err.message);
    } finally {
      setSimulating(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search.trim()) {
      const term = search.toLowerCase();
      return (
        p.orderNumber?.toLowerCase().includes(term) ||
        p.transactionId?.toLowerCase().includes(term) ||
        p.customerEmail?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payment Transactions</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gateway transaction logs, reconciliation records, and webhook architecture
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={loadPayments} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button size="sm" onClick={() => setIsWebhookModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-500">
            <Zap className="mr-1.5 h-3.5 w-3.5" />
            Gateway Webhook Simulator
          </Button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="sm:col-span-2 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search by Order #, Transaction ID, or Customer Email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Payment Statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="refunded">Refunded</option>
          <option value="partially_refunded">Partially Refunded</option>
          <option value="failed">Failed</option>
        </Select>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading payment records...</div>
        ) : filteredPayments.length === 0 ? (
          <EmptyState
            title="No Payment Records Found"
            description="Payment records are generated automatically when orders are submitted."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 uppercase font-semibold">
                  <th className="py-3 px-4">Transaction ID</th>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Customer Email</th>
                  <th className="py-3 px-4">Method / Gateway</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Refunded</th>
                  <th className="py-3 px-4">Paid At</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {p.transactionId || p.id}
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-indigo-600">
                      {p.orderNumber || p.orderId}
                    </td>

                    <td className="py-3 px-4 text-slate-600">{p.customerEmail}</td>

                    <td className="py-3 px-4">
                      <span className="font-semibold uppercase text-slate-700 block">{p.method}</span>
                      <span className="text-[10px] text-slate-400 capitalize">{p.gateway}</span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <PaymentStatusBadge status={p.status} />
                    </td>

                    <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                      {formatCurrency(p.amount)}
                    </td>

                    <td className="py-3 px-4 text-right text-rose-600 font-semibold">
                      {p.refundedAmount && p.refundedAmount > 0 ? `-${formatCurrency(p.refundedAmount)}` : "-"}
                    </td>

                    <td className="py-3 px-4 text-slate-500">{formatDate(p.paidAt || p.createdAt)}</td>

                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/admin/orders/${p.orderId}`}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Order
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Webhook Simulator Modal */}
      <Modal
        isOpen={isWebhookModalOpen}
        onClose={() => setIsWebhookModalOpen(false)}
        title="Payment Gateway Webhook Simulator"
        description="Simulate asynchronous payment confirmation webhooks from Razorpay or Stripe"
        maxWidth="md"
      >
        <form onSubmit={handleSimulateWebhook} className="space-y-4">
          <Input
            label="Order ID / Document ID *"
            placeholder="e.g. paste Firestore order ID"
            value={webhookOrderId}
            onChange={(e) => setWebhookOrderId(e.target.value)}
            required
          />

          <Select
            label="Webhook Event *"
            value={webhookEvent}
            onChange={(e) => setWebhookEvent(e.target.value as any)}
          >
            <option value="payment.captured">payment.captured (Mark Paid & Confirmed)</option>
            <option value="payment.failed">payment.failed (Mark Failed)</option>
          </Select>

          {simResult && (
            <pre className="p-3 rounded-lg bg-slate-900 text-indigo-300 font-mono text-[11px] overflow-x-auto max-h-36">
              {simResult}
            </pre>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsWebhookModalOpen(false)}>
              Close
            </Button>
            <Button type="submit" size="sm" loading={simulating} className="bg-indigo-600 hover:bg-indigo-500">
              Dispatch Webhook
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
