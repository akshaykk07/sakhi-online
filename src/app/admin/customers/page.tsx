"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { customerService } from "@/features/customers/customerService";
import { Customer } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/Select";
import { Users, Search, Eye, ShoppingBag, ArrowRight } from "lucide-react";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await customerService.getCustomers();
      setCustomers(data);
    } catch (e) {
      console.error("Customers load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    if (search.trim()) {
      const term = search.toLowerCase();
      return (
        c.name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.includes(term) ||
        c.city?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customer Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Profiles automatically compiled from validated order transactions
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search customers by name, email, phone number, or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading customer profiles...</div>
        ) : filteredCustomers.length === 0 ? (
          <EmptyState
            title="No Customers Yet"
            description="Customers are automatically recorded when orders are placed in the storefront."
            actionLabel="Open Storefront"
            onAction={() => window.open("/store", "_blank")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 uppercase font-semibold">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-center">Orders</th>
                  <th className="py-3 px-4 text-right">Lifetime Spending</th>
                  <th className="py-3 px-4">Last Order</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {c.name?.charAt(0).toUpperCase() || "C"}
                        </div>
                        <span className="font-semibold text-slate-900 block">{c.name}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-slate-800 block font-medium">{c.email}</span>
                      <span className="text-slate-500 text-[11px] block">{c.phone}</span>
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      {c.city ? `${c.city}, ${c.state || ""}` : "Unspecified"}
                    </td>

                    <td className="py-3 px-4 text-center font-bold text-slate-800">{c.totalOrders || 1}</td>

                    <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                      {formatCurrency(c.totalSpending || 0)}
                    </td>

                    <td className="py-3 px-4 text-slate-500">{formatDate(c.lastOrderDate)}</td>

                    <td className="py-3 px-4 text-right">
                      <Link href={`/admin/customers/${c.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold text-indigo-600">
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          Profile
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
          totalItems={filteredCustomers.length}
          pageSize={pageSize}
        />
      </div>
    </div>
  );
}
