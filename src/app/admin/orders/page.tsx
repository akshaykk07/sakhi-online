"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { orderService } from "@/features/orders/orderService";
import { Order, OrderStatus } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/Select";
import {
  ShoppingBag,
  Search,
  Filter,
  Eye,
  FileText,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await orderService.getOrders({
        status: statusFilter !== "all" ? (statusFilter as OrderStatus) : undefined,
        search,
        limit: 100,
      });
      setOrders(data);
    } catch (e) {
      console.error("Orders load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadOrders();
  };

  const filteredOrders = orders.filter((o) => {
    if (search.trim()) {
      const term = search.toLowerCase();
      return (
        o.orderNumber?.toLowerCase().includes(term) ||
        o.customerSnapshot?.name?.toLowerCase().includes(term) ||
        o.customerSnapshot?.email?.toLowerCase().includes(term) ||
        o.customerSnapshot?.phone?.includes(term)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Order Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated customer orders, status transitions, immutable snapshots, and invoicing
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={loadOrders} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Link href="/store" target="_blank">
            <Button size="sm" variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50/50">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Store Checkout
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="sm:col-span-2 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search by order number, customer name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </form>

        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="all">All Order Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
          <option value="returned">Returned</option>
          <option value="refunded">Refunded</option>
        </Select>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading order records...</div>
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            title="No Orders Found"
            description="No customer orders match your search or filter. Test order creation in the Storefront."
            actionLabel="Open Storefront"
            onAction={() => window.open("/store", "_blank")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 uppercase font-semibold">
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4">Order Status</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {ord.orderNumber}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 block">{ord.customerSnapshot?.name}</span>
                      <span className="text-[11px] text-slate-500 block">{ord.customerSnapshot?.email}</span>
                    </td>

                    <td className="py-3 px-4 text-slate-500">{formatDate(ord.createdAt)}</td>

                    <td className="py-3 px-4 text-center font-medium text-slate-700">
                      {ord.items?.reduce((s, i) => s + i.quantity, 0) || 0}
                    </td>

                    <td className="py-3 px-4">
                      <OrderStatusBadge status={ord.orderStatus} />
                    </td>

                    <td className="py-3 px-4">
                      <PaymentStatusBadge status={ord.paymentStatus} />
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(ord.total)}
                    </td>

                    <td className="py-3 px-4 text-right space-x-1">
                      <Link href={`/admin/orders/${ord.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold text-indigo-600">
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          View
                        </Button>
                      </Link>

                      <Link href={`/invoice/${ord.id}`} target="_blank">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900">
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredOrders.length}
          pageSize={pageSize}
        />
      </div>
    </div>
  );
}
