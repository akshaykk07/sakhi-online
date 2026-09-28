"use client";

import React, { useState, useEffect } from "react";
import { inventoryService } from "@/features/inventory/inventoryService";
import { productService } from "@/features/products/productService";
import { useAuth } from "@/features/auth/AuthContext";
import { InventoryTransaction, InventoryTransactionType, Product } from "@/types";
import { formatDate } from "@/lib/utils/cn";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/Select";
import {
  Boxes,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Search,
  CheckCircle,
} from "lucide-react";

export default function InventoryPage() {
  const { adminProfile, hasPermission } = useAuth();
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Stock Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState("");
  const [adjustType, setAdjustType] = useState<InventoryTransactionType>("stock_in");
  const [adjustQuantity, setAdjustQuantity] = useState<number | "">(10);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState("");

  useEffect(() => {
    loadInventoryData();
  }, [typeFilter, selectedProduct]);

  const loadInventoryData = async () => {
    setLoading(true);
    try {
      const [txs, prods] = await Promise.all([
        inventoryService.getTransactions({
          type: typeFilter !== "all" ? (typeFilter as InventoryTransactionType) : undefined,
          productId: selectedProduct !== "all" ? selectedProduct : undefined,
          limit: 150,
        }),
        productService.getProducts({ limit: 100 }),
      ]);
      setTransactions(txs);
      setProducts(prods.products);
      setLowStockProducts(prods.products.filter((p) => p.stockQuantity <= (p.lowStockThreshold || 5)));
    } catch (e) {
      console.error("Inventory load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdjust = (prodId?: string) => {
    setAdjustProductId(prodId || (products[0]?.id || ""));
    setAdjustType("stock_in");
    setAdjustQuantity(10);
    setAdjustReason("");
    setAdjustError("");
    setIsAdjustModalOpen(true);
  };

  const handleExecuteAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProductId) return setAdjustError("Please select a product.");
    const numQty = Number(adjustQuantity);
    if (isNaN(numQty) || numQty <= 0) return setAdjustError("Quantity must be a positive integer.");
    if (!adjustReason.trim()) return setAdjustError("Reason is required for inventory audit.");

    setAdjusting(true);
    setAdjustError("");

    try {
      // Delta is positive for stock_in and return, negative for stock_out, damage
      const isReduction = ["stock_out", "damage"].includes(adjustType);
      const delta = isReduction ? -Math.abs(numQty) : Math.abs(numQty);

      await inventoryService.adjustStock({
        productId: adjustProductId,
        type: adjustType,
        quantity: delta,
        reason: adjustReason.trim(),
        adminId: adminProfile?.uid || "admin",
        adminName: adminProfile?.displayName || "Administrator",
      });

      setIsAdjustModalOpen(false);
      loadInventoryData();
    } catch (err: any) {
      setAdjustError(err.message || "Failed to adjust stock.");
    } finally {
      setAdjusting(false);
    }
  };

  const totalPages = Math.ceil(transactions.length / pageSize) || 1;
  const paginatedTransactions = transactions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getTransactionBadge = (type: InventoryTransactionType) => {
    switch (type) {
      case "order":
        return <Badge variant="warning">Order Sale</Badge>;
      case "stock_in":
        return <Badge variant="success">Stock In</Badge>;
      case "stock_out":
        return <Badge variant="danger">Stock Out</Badge>;
      case "return":
        return <Badge variant="info">Return Restock</Badge>;
      case "refund":
        return <Badge variant="info">Refund Restock</Badge>;
      case "damage":
        return <Badge variant="danger">Damage/Loss</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory Ledger</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable tracking of stock movements, orders, restocks, returns, and damages
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={loadInventoryData} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {hasPermission("inventory.update") && (
            <Button size="sm" onClick={() => handleOpenAdjust()}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Adjust Stock
            </Button>
          )}
        </div>
      </div>

      {/* Low Stock Alerts Notice */}
      {lowStockProducts.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-amber-950">
                {lowStockProducts.length} Product(s) at or below threshold!
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {lowStockProducts.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-md bg-white border border-amber-200 px-2 py-1 font-medium text-[11px]"
                  >
                    <span>{p.name}:</span>
                    <strong className={p.stockQuantity === 0 ? "text-rose-600" : "text-amber-700"}>
                      {p.stockQuantity} in stock
                    </strong>
                    <button
                      onClick={() => handleOpenAdjust(p.id)}
                      className="ml-1 text-indigo-600 hover:underline cursor-pointer font-bold"
                    >
                      +Restock
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <Select
          label="Filter by Product"
          value={selectedProduct}
          onChange={(e) => {
            setSelectedProduct(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="all">All Products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} (Current Stock: {p.stockQuantity})
            </option>
          ))}
        </Select>

        <Select
          label="Filter by Movement Type"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="all">All Movement Types</option>
          <option value="order">Customer Orders (Automatic)</option>
          <option value="stock_in">Stock In (Restock)</option>
          <option value="stock_out">Stock Out (Manual)</option>
          <option value="return">Return Restock</option>
          <option value="refund">Refund Restock</option>
          <option value="damage">Damage / Loss</option>
          <option value="manual_adjustment">Manual Adjustment</option>
        </Select>
      </div>

      {/* Transactions Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading inventory ledger...</div>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            title="No Transactions Found"
            description="Inventory changes from sales or restocks will appear here in the ledger."
            actionLabel="Adjust Stock"
            onAction={() => handleOpenAdjust()}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 uppercase font-semibold">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center">Change</th>
                  <th className="py-3 px-4 text-center">Prev → New</th>
                  <th className="py-3 px-4">Reason / Reference</th>
                  <th className="py-3 px-4">Authorized By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{formatDate(tx.createdAt)}</td>

                    <td className="py-3 px-4 font-semibold text-slate-900">{tx.productName}</td>

                    <td className="py-3 px-4">{getTransactionBadge(tx.type)}</td>

                    <td className="py-3 px-4 text-center font-bold font-mono">
                      <span className={tx.quantity < 0 ? "text-rose-600" : "text-emerald-600"}>
                        {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center text-slate-600 font-mono">
                      {tx.previousStock} → <span className="font-bold text-slate-900">{tx.newStock}</span>
                    </td>

                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{tx.reason}</td>

                    <td className="py-3 px-4 text-slate-500">{tx.performedByName || tx.performedBy}</td>
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
          totalItems={transactions.length}
          pageSize={pageSize}
        />
      </div>

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Adjust Inventory Stock"
        description="Records an audit-verified transaction and updates product inventory"
        maxWidth="md"
      >
        <form onSubmit={handleExecuteAdjust} className="space-y-4">
          {adjustError && (
            <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              {adjustError}
            </p>
          )}

          <Select
            label="Product *"
            value={adjustProductId}
            onChange={(e) => setAdjustProductId(e.target.value)}
            required
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (Current: {p.stockQuantity})
              </option>
            ))}
          </Select>

          <Select
            label="Adjustment Type *"
            value={adjustType}
            onChange={(e) => setAdjustType(e.target.value as InventoryTransactionType)}
            required
          >
            <option value="stock_in">Stock In (Purchase/Restock +)</option>
            <option value="stock_out">Stock Out (Correction -)</option>
            <option value="damage">Damage / Loss (-)</option>
            <option value="manual_adjustment">Manual Adjustment (+)</option>
          </Select>

          <Input
            label="Quantity Units *"
            type="number"
            min="1"
            value={adjustQuantity}
            onChange={(e) => setAdjustQuantity(e.target.value === "" ? "" : Number(e.target.value))}
            required
          />

          <Textarea
            label="Operational Reason *"
            placeholder="e.g. Supplier batch #948, damaged in transit, warehouse physical count..."
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
            required
            rows={2}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsAdjustModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={adjusting} className="bg-slate-900">
              Apply Stock Adjustment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
