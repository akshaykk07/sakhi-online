"use client";

import React, { useState, useEffect } from "react";
import { categoryService } from "@/features/categories/categoryService";
import { useAuth } from "@/features/auth/AuthContext";
import { Category, CategoryDeleteAction } from "@/types";
import { formatDate } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Select";
import {
  Plus,
  Edit,
  Trash2,
  Layers,
  AlertTriangle,
  FolderOpen,
  Upload,
  CheckCircle,
  X,
} from "lucide-react";

export default function CategoriesPage() {
  const { adminProfile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal create/edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Safe Deletion Workflow state
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [affectedProductCount, setAffectedProductCount] = useState<number>(0);
  const [deleteResolution, setDeleteResolution] = useState<"uncategorized" | "reassign">("uncategorized");
  const [reassignTargetId, setReassignTargetId] = useState<string>("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await categoryService.getCategories();
      setCategories(data);
    } catch (e) {
      console.error("Failed to load categories:", e);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setName("");
    setSlug("");
    setDescription("");
    setImageUrl("");
    setActive(true);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || "");
    setImageUrl(cat.image || "");
    setActive(cat.active);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Category name is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: description.trim(),
        image: imageUrl.trim() || "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&auto=format&fit=crop&q=80",
        active,
      };

      if (editingCategory) {
        await categoryService.updateCategory(
          editingCategory.id,
          payload,
          adminProfile?.uid || "admin",
          adminProfile?.displayName || "Administrator"
        );
      } else {
        await categoryService.createCategory(
          payload,
          adminProfile?.uid || "admin",
          adminProfile?.displayName || "Administrator"
        );
      }

      setIsModalOpen(false);
      loadCategories();
    } catch (err: any) {
      setFormError(err.message || "Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

  const promptDelete = async (cat: Category) => {
    const count = await categoryService.checkCategoryProductsCount(cat.id);
    setDeleteTarget(cat);
    setAffectedProductCount(count);
    setDeleteResolution("uncategorized");
    const otherCats = categories.filter((c) => c.id !== cat.id);
    if (otherCats.length > 0) setReassignTargetId(otherCats[0].id);
  };

  const handleExecuteDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const action: CategoryDeleteAction = {
        target: deleteResolution,
        reassignCategoryId: deleteResolution === "reassign" ? reassignTargetId : undefined,
      };

      await categoryService.deleteCategorySafe(
        deleteTarget.id,
        action,
        adminProfile?.uid || "admin",
        adminProfile?.displayName || "Administrator"
      );

      setDeleteTarget(null);
      loadCategories();
    } catch (err: any) {
      alert("Error deleting category: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Category Hierarchy</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize catalog products into consumer departments and store classifications
          </p>
        </div>

        <Button size="sm" onClick={openCreateModal}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Category
        </Button>
      </div>

      {/* Categories Grid / Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading categories...</div>
        ) : categories.length === 0 ? (
          <EmptyState
            title="No Categories Configured"
            description="Create your first catalog category or seed the initial store setup."
            actionLabel="Add Category"
            onAction={openCreateModal}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 uppercase font-semibold">
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Slug</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={c.image || "/placeholder.png"}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0"
                        />
                        <span className="font-semibold text-slate-900 text-sm">{c.name}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-600 font-medium">{c.slug}</td>

                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                      {c.description || "-"}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <Badge variant={c.active ? "success" : "secondary"}>
                        {c.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 text-slate-500">{formatDate(c.createdAt)}</td>

                    <td className="py-3 px-4 text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-600"
                        onClick={() => openEditModal(c)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => promptDelete(c)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? "Edit Category" : "Create New Category"}
        description="Configure department information and thumbnail"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              {formError}
            </p>
          )}

          <Input
            label="Category Name *"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
            }}
            placeholder="e.g. Consumer Electronics"
            required
          />

          <Input
            label="Slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. consumer-electronics"
          />

          <Input
            label="Thumbnail Image URL"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
          />

          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional summary of merchandise under this classification"
            rows={2}
          />

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="cat-active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
            />
            <label htmlFor="cat-active" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Active in storefront
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={saving} className="bg-slate-900">
              {editingCategory ? "Update Category" : "Save Category"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Safe Category Deletion Workflow Modal */}
      {deleteTarget && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Safe Category Deletion"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold">
                  Category &quot;{deleteTarget.name}&quot; currently contains {affectedProductCount} product(s).
                </p>
                <p>
                  To preserve database integrity, existing products cannot be orphaned. Please select a resolution action:
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="radio"
                  name="resolution"
                  value="uncategorized"
                  checked={deleteResolution === "uncategorized"}
                  onChange={() => setDeleteResolution("uncategorized")}
                  className="text-slate-900"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">Move products to &quot;Uncategorized&quot;</span>
                  <span className="text-slate-500">Products will remain active without a department.</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="radio"
                  name="resolution"
                  value="reassign"
                  checked={deleteResolution === "reassign"}
                  onChange={() => setDeleteResolution("reassign")}
                  className="text-slate-900"
                />
                <div className="flex-1">
                  <span className="font-semibold text-slate-900 block">Reassign products to another category</span>
                  {deleteResolution === "reassign" && (
                    <div className="mt-2">
                      <Select
                        value={reassignTargetId}
                        onChange={(e) => setReassignTargetId(e.target.value)}
                      >
                        {categories
                          .filter((c) => c.id !== deleteTarget.id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </Select>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={deleting}
                onClick={handleExecuteDelete}
              >
                Delete Category & Reassign
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
