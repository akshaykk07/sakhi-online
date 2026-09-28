"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { customerService } from "@/features/customers/customerService";
import { Customer, Order } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils/cn";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/Badge";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  ShoppingBag,
  TrendingUp,
  Loader2,
  ExternalLink,
} from "lucide-react";

export default function CustomerProfilePage() {
  const params = useParams();
  const customerId = params.id as string;
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [c, ords] = await Promise.all([
          customerService.getCustomer(customerId),
          customerService.getCustomerOrders(customerId),
        ]);
        setCustomer(c);
        setOrders(ords);
      } catch (e) {
        console.error("Error loading customer profile:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [customerId]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-800" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-12 text-center text-xs text-slate-500">
        Customer record not found.
      </div>
    );
  }

  const avgPerOrder =
    orders.length > 0
      ? Number(((customer.totalSpending || 0) / orders.length).toFixed(2))
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{customer.name}</h1>
          <p className="text-xs text-slate-500">Customer ID: {customer.id}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500">
              Total Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {formatCurrency(customer.totalSpending || 0)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Lifetime verified purchase value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500">
              Total Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">{orders.length}</div>
            <p className="text-[11px] text-slate-500 mt-1">Processed transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500">
              Average Order Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">{formatCurrency(avgPerOrder)}</div>
            <p className="text-[11px] text-slate-500 mt-1">Per transaction average</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Contact & Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <Mail className="h-4 w-4 text-slate-400" />
              <span>{customer.email}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <Phone className="h-4 w-4 text-slate-400" />
              <span>{customer.phone}</span>
            </div>
            <div className="flex items-start gap-2 text-slate-700 pt-2 border-t border-slate-100">
              <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p>{customer.address || "No address recorded"}</p>
                {customer.city && (
                  <p>
                    {customer.city}, {customer.state} - {customer.pinCode}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-500 pt-2 border-t border-slate-100">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span>Member since: {formatDate(customer.createdAt)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Order History */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Order History</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No orders found for this customer.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="py-2.5 px-3">Order Number</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Payment</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-mono font-semibold text-slate-900">
                          {o.orderNumber}
                        </td>
                        <td className="py-3 px-3 text-slate-500">{formatDate(o.createdAt)}</td>
                        <td className="py-3 px-3">
                          <OrderStatusBadge status={o.orderStatus} />
                        </td>
                        <td className="py-3 px-3">
                          <PaymentStatusBadge status={o.paymentStatus} />
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(o.total)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Link
                            href={`/admin/orders/${o.id}`}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            Details
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
    </div>
  );
}
