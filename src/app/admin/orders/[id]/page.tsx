"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { orderService } from "@/features/orders/orderService";
import { useAuth } from "@/features/auth/AuthContext";
import { Order, OrderStatus, OrderStatusHistory } from "@/types";
import { canTransitionOrderStatus } from "@/lib/business-rules";
import { formatCurrency, formatDate } from "@/lib/utils/cn";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import {
  ArrowLeft,
  FileText,
  Clock,
  User,
  MapPin,
  CreditCard,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Truck,
  ExternalLink,
  Loader2,
} from "lucide-react";

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const { adminProfile, hasPermission } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);

  // Status transition state
  const [targetStatus, setTargetStatus] = useState<OrderStatus | "">("");
  const [transitionNote, setTransitionNote] = useState("");
  const [confirmStatusModal, setConfirmStatusModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");

  // Refund state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number | "">("");
  const [refundReason, setRefundReason] = useState("");
  const [restoreStock, setRestoreStock] = useState(true);
  const [processingRefund, setProcessingRefund] = useState(false);
  const [refundError, setRefundError] = useState("");

  useEffect(() => {
    loadOrderDetails();
  }, [orderId]);

  const loadOrderDetails = async () => {
    setLoading(true);
    try {
      const [ord, hist] = await Promise.all([
        orderService.getOrder(orderId),
        orderService.getOrderStatusHistory(orderId),
      ]);
      setOrder(ord);
      setHistory(hist);
    } catch (e) {
      console.error("Order details load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChangeClick = (newStatus: OrderStatus) => {
    if (!order) return;
    setStatusError("");
    const check = canTransitionOrderStatus(order.orderStatus, newStatus);
    if (!check.allowed) {
      setStatusError(check.reason || "Invalid status transition");
      return;
    }

    setTargetStatus(newStatus);
    setTransitionNote("");
    if (check.requiresConfirmation) {
      setConfirmStatusModal(true);
    } else {
      executeStatusUpdate(newStatus, "");
    }
  };

  const executeStatusUpdate = async (newStatus: OrderStatus, note: string) => {
    setUpdatingStatus(true);
    setStatusError("");
    try {
      await orderService.updateOrderStatus(
        orderId,
        newStatus,
        note,
        adminProfile?.uid || "admin",
        adminProfile?.displayName || "Administrator"
      );
      setConfirmStatusModal(false);
      setTargetStatus("");
      loadOrderDetails();
    } catch (err: any) {
      setStatusError(err.message || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openRefundModal = () => {
    if (!order) return;
    const remaining = (order.total || 0) - (order.refundAmount || 0);
    setRefundAmount(remaining > 0 ? remaining : 0);
    setRefundReason("");
    setRestoreStock(true);
    setRefundError("");
    setShowRefundModal(true);
  };

  const handleExecuteRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !refundAmount || Number(refundAmount) <= 0) return;

    setProcessingRefund(true);
    setRefundError("");
    try {
      await orderService.processRefund(
        orderId,
        Number(refundAmount),
        refundReason,
        restoreStock,
        adminProfile?.uid || "admin",
        adminProfile?.displayName || "Administrator"
      );
      setShowRefundModal(false);
      loadOrderDetails();
    } catch (err: any) {
      setRefundError(err.message || "Failed to process refund");
    } finally {
      setProcessingRefund(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-800" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-12 text-center text-xs text-slate-500">
        Order not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link href="/admin/orders">
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-mono font-bold text-slate-900">
                Order #{order.orderNumber}
              </h1>
              <OrderStatusBadge status={order.orderStatus} />
              <PaymentStatusBadge status={order.paymentStatus} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Placed on {formatDate(order.createdAt)} • ID: {order.id}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission("orders.refund") && order.orderStatus !== "cancelled" && (
            <Button variant="outline" size="sm" onClick={openRefundModal} className="text-rose-600 border-rose-200 hover:bg-rose-50">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Process Refund
            </Button>
          )}

          <Link href={`/invoice/${order.id}`} target="_blank">
            <Button size="sm">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Tax Invoice
            </Button>
          </Link>
        </div>
      </div>

      {statusError && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{statusError}</span>
        </div>
      )}

      {/* Lifecycle Status Stepper & Transition Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Order Status & Lifecycle Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-semibold text-slate-500 mr-2">Transition to:</span>

            {(["confirmed", "processing", "shipped", "delivered", "cancelled", "returned", "refunded"] as OrderStatus[]).map(
              (st) => {
                const check = canTransitionOrderStatus(order.orderStatus, st);
                return (
                  <Button
                    key={st}
                    size="sm"
                    variant={st === "cancelled" || st === "refunded" ? "danger" : "outline"}
                    disabled={!check.allowed || updatingStatus}
                    onClick={() => handleStatusChangeClick(st)}
                    className="capitalize text-xs h-8"
                  >
                    {st}
                  </Button>
                );
              }
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Line Items & Pricing Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Purchased Items (Immutable Snapshot)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="py-2.5 px-3">Item</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Price</th>
                      <th className="py-2.5 px-3 text-right">Tax</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.items?.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={item.image || "/placeholder.png"}
                              alt=""
                              className="h-9 w-9 rounded-md object-cover bg-slate-100 border border-slate-200 shrink-0"
                            />
                            <div>
                              <span className="font-semibold text-slate-900 block">{item.name}</span>
                              {item.variantName && (
                                <span className="text-[10px] text-slate-500 block">
                                  Variant: {item.variantName}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-500">{item.sku}</td>
                        <td className="py-3 px-3 text-center font-bold text-slate-800">{item.quantity}</td>
                        <td className="py-3 px-3 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-3 px-3 text-right text-slate-500">{formatCurrency(item.tax)}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals */}
              <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
                <div className="w-64 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Discount ({order.couponCode || "Coupon"}):</span>
                      <span>-{formatCurrency(order.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>GST / Taxes:</span>
                    <span>{formatCurrency(order.tax)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Delivery Charges:</span>
                    <span>{order.deliveryCharge === 0 ? "FREE" : formatCurrency(order.deliveryCharge)}</span>
                  </div>
                  {order.refundAmount !== undefined && order.refundAmount > 0 && (
                    <div className="flex justify-between text-rose-600 font-semibold">
                      <span>Refunded:</span>
                      <span>-{formatCurrency(order.refundAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-900 font-extrabold text-sm pt-2 border-t border-slate-200">
                    <span>Grand Total:</span>
                    <span>{formatCurrency(order.total)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status History Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status Audit Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-xs text-slate-400">No status audit history recorded.</p>
              ) : (
                <div className="relative pl-6 space-y-4 border-l-2 border-slate-200 ml-2 text-xs">
                  {history.map((h) => (
                    <div key={h.id} className="relative group">
                      <div className="absolute -left-[31px] top-0.5 h-3.5 w-3.5 rounded-full bg-indigo-600 border-2 border-white ring-2 ring-indigo-200" />
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 capitalize">{h.newStatus}</span>
                        <span className="text-[10px] text-slate-400">{formatDate(h.timestamp)}</span>
                      </div>
                      <p className="text-slate-600 mt-0.5">{h.note || "No note"}</p>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        By: <span className="font-medium text-slate-700">{h.changedByName || h.changedBy}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Customer & Payment Details */}
        <div className="space-y-6">
          {/* Customer Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Customer Shipping Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <User className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900 text-sm">{order.customerSnapshot?.name}</p>
                  <p className="text-slate-500">{order.customerSnapshot?.email}</p>
                  <p className="text-slate-500">{order.customerSnapshot?.phone}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2 border-t border-slate-100">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-700">Delivery Address</p>
                  <p className="text-slate-600">{order.customerSnapshot?.address}</p>
                  <p className="text-slate-600">
                    {order.customerSnapshot?.city}, {order.customerSnapshot?.state} - {order.customerSnapshot?.pinCode}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Payment Architecture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Method:</span>
                <span className="font-semibold uppercase">{order.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction ID:</span>
                <span className="font-mono font-semibold">{order.transactionId || "N/A"}</span>
              </div>
              {order.deliveredAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Delivered At:</span>
                  <span>{formatDate(order.deliveredAt)}</span>
                </div>
              )}
              {order.cancelledAt && (
                <div className="flex justify-between text-rose-600">
                  <span>Cancelled At:</span>
                  <span>{formatDate(order.cancelledAt)}</span>
                </div>
              )}
              {order.refundedAt && (
                <div className="flex justify-between text-rose-600">
                  <span>Refunded At:</span>
                  <span>{formatDate(order.refundedAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sensitive Status Transition Confirmation Dialog */}
      <Modal
        isOpen={confirmStatusModal}
        onClose={() => setConfirmStatusModal(false)}
        title={`Confirm Status Transition to "${targetStatus}"`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Sensitive Status Transition</p>
              <p>
                Transitioning this order to <span className="font-bold uppercase">{targetStatus}</span> will automatically execute inventory stock restorations and update ledger records.
              </p>
            </div>
          </div>

          <Textarea
            label="Internal Operational Note"
            placeholder="Reason for cancellation, return, or status change..."
            value={transitionNote}
            onChange={(e) => setTransitionNote(e.target.value)}
            rows={3}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setConfirmStatusModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={updatingStatus}
              onClick={() => targetStatus && executeStatusUpdate(targetStatus, transitionNote)}
            >
              Confirm Status Transition
            </Button>
          </div>
        </div>
      </Modal>

      {/* Refund Execution Modal */}
      <Modal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        title="Process Financial Refund"
        maxWidth="md"
      >
        <form onSubmit={handleExecuteRefund} className="space-y-4">
          {refundError && (
            <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              {refundError}
            </p>
          )}

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Order Total:</span>
              <span className="font-bold">{formatCurrency(order.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Previously Refunded:</span>
              <span className="text-rose-600 font-semibold">
                {formatCurrency(order.refundAmount || 0)}
              </span>
            </div>
          </div>

          <Input
            label="Refund Amount (₹) *"
            type="number"
            step="0.01"
            min="0.01"
            max={Number(((order.total || 0) - (order.refundAmount || 0)).toFixed(2))}
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value === "" ? "" : Number(e.target.value))}
            required
          />

          <Textarea
            label="Reason for Refund *"
            placeholder="Customer request, damaged goods, fulfillment delay..."
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            required
            rows={2}
          />

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="restoreStock"
              checked={restoreStock}
              onChange={(e) => setRestoreStock(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
            />
            <label htmlFor="restoreStock" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Automatically restore inventory stock to catalog
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setShowRefundModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" type="submit" loading={processingRefund}>
              Execute Refund
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
