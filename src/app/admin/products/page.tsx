"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { productService } from "@/features/products/productService";
import { categoryService } from "@/features/categories/categoryService";
import { Product, Category, ProductStatus } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { Pagination } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/Select";
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Package,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Layers,
  Sparkles,
} from "lucide-react";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Deletion modal
  const [deleteProductTarget, setDeleteProductTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedCategory, statusFilter, stockFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        productService.getProducts({
          categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
          status: statusFilter !== "all" ? (statusFilter as ProductStatus) : undefined,
          stockFilter,
          search,
          limit: 100,
        }),
        categoryService.getCategories(),
      ]);
      setProducts(prodRes.products);
      setCategories(catRes);
    } catch (e) {
      console.error("Products load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteProductTarget) return;
    setDeleting(true);
    try {
      await productService.deleteProduct(deleteProductTarget.id);
      setProducts((prev) => prev.filter((p) => p.id !== deleteProductTarget.id));
      setDeleteProductTarget(null);
    } catch (err: any) {
      alert("Error deleting product: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (search.trim()) {
      const term = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term) ||
        p.brand?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Product Catalog</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage merchandise items, pricing, attributes, images, and live inventory
          </p>
        </div>

        <Link href="/admin/products/new">
          <Button size="sm">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add New Product
          </Button>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="lg:col-span-2 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search by title, SKU, or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </form>

        <Select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="draft">Draft</option>
        </Select>

        <Select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value as any)}
        >
          <option value="all">All Stock Levels</option>
          <option value="in_stock">In Stock (&gt;0)</option>
          <option value="low_stock">Low Stock (≤5)</option>
          <option value="out_of_stock">Out of Stock (0)</option>
        </Select>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading catalog items...</div>
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            title="No Products Found"
            description="No merchandise matches your current filter or search criteria."
            actionLabel="Add First Product"
            onAction={() => (window.location.href = "/admin/products/new")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 uppercase font-semibold">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Selling Price</th>
                  <th className="py-3 px-4 text-center">Stock</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedProducts.map((p) => {
                  const isLow = p.stockQuantity <= (p.lowStockThreshold || 5) && p.stockQuantity > 0;
                  const isOut = p.stockQuantity === 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.images?.[0] || "/placeholder.png"}
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0"
                          />
                          <div>
                            <span className="font-semibold text-slate-900 block line-clamp-1">{p.name}</span>
                            <span className="text-[11px] text-slate-400 block">{p.brand || "Unbranded"}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-600 font-medium">{p.sku || "-"}</td>

                      <td className="py-3 px-4 text-slate-600">{p.categoryName || "General"}</td>

                      <td className="py-3 px-4 text-right font-medium text-slate-900">
                        {p.discountPrice && p.discountPrice > 0 ? (
                          <div>
                            <span className="text-slate-900 font-bold">{formatCurrency(p.discountPrice)}</span>
                            <span className="ml-1 text-[10px] text-slate-400 line-through">
                              {formatCurrency(p.sellingPrice)}
                            </span>
                          </div>
                        ) : (
                          formatCurrency(p.sellingPrice)
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-bold text-[11px] ${
                            isOut
                              ? "bg-rose-100 text-rose-700"
                              : isLow
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {p.stockQuantity}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant={
                            p.status === "active"
                              ? "success"
                              : p.status === "draft"
                              ? "secondary"
                              : "danger"
                          }
                        >
                          {p.status}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-right space-x-1">
                        <Link href={`/admin/products/${p.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </Link>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => setDeleteProductTarget(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredProducts.length}
          pageSize={pageSize}
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteProductTarget}
        onClose={() => setDeleteProductTarget(null)}
        onConfirm={handleDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteProductTarget?.name}"? This action removes the item from the catalog.`}
        confirmLabel="Delete Product"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
