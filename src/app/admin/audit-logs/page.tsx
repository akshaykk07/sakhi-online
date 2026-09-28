"use client";

import React, { useState, useEffect } from "react";
import { auditService } from "@/features/audit/auditService";
import { AuditLog } from "@/types";
import { formatDate } from "@/lib/utils/cn";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/Select";
import { History, RefreshCw, Search, Shield, Filter } from "lucide-react";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await auditService.getAuditLogs(100);
      setLogs(data);
    } catch (e) {
      console.error("Audit log error:", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (collectionFilter !== "all" && log.collection !== collectionFilter) return false;
    if (search.trim()) {
      const term = search.toLowerCase();
      return (
        log.action?.toLowerCase().includes(term) ||
        log.adminName?.toLowerCase().includes(term) ||
        log.documentId?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Audit Compliance Logs</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable trace of administrator actions, inventory mutations, and financial adjustments
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="sm:col-span-2 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search actions, administrator names, or document IDs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <Select
          value={collectionFilter}
          onChange={(e) => {
            setCollectionFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="all">All Domain Collections</option>
          <option value="products">Products</option>
          <option value="orders">Orders</option>
          <option value="categories">Categories</option>
          <option value="coupons">Coupons</option>
          <option value="settings">Settings</option>
        </Select>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading audit records...</div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            title="No Audit Records"
            description="Administrative actions and state updates will automatically be recorded here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 uppercase font-semibold">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Administrator</th>
                  <th className="py-3 px-4">Document ID</th>
                  <th className="py-3 px-4">Changes / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{formatDate(log.timestamp)}</td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-700 capitalize">
                      {log.collection}
                    </td>

                    <td className="py-3 px-4 text-slate-800 font-medium">
                      {log.adminName || log.adminId}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {log.documentId}
                    </td>

                    <td className="py-3 px-4 max-w-xs truncate text-slate-500">
                      {log.metadata
                        ? JSON.stringify(log.metadata)
                        : log.newValue
                        ? JSON.stringify(log.newValue)
                        : "-"}
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
          totalItems={filteredLogs.length}
          pageSize={pageSize}
        />
      </div>
    </div>
  );
}
