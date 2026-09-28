"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { productService } from "@/features/products/productService";
import { categoryService } from "@/features/categories/categoryService";
import { useAuth } from "@/features/auth/AuthContext";
import { Category, ProductStatus } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { ArrowLeft, Upload, X, Plus, AlertCircle, Save } from "lucide-react";

export default function NewProductPage() {
  const router = useRouter();
  const { adminProfile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form states
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sku, setSku] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");

  const [costPrice, setCostPrice] = useState<number | "">(0);
  const [sellingPrice, setSellingPrice] = useState<number | "">(0);
  const [discountPrice, setDiscountPrice] = useState<number | "">("");

  const [stockQuantity, setStockQuantity] = useState<number | "">(10);
  const [lowStockThreshold, setLowStockThreshold] = useState<number | "">(5);

  const [status, setStatus] = useState<ProductStatus>("active");
  const [featured, setFeatured] = useState(false);

  // Images state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [externalImageUrls, setExternalImageUrls] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");

  // Simple attributes & variants
  const [weight, setWeight] = useState<number | "">("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");

  useEffect(() => {
    categoryService.getCategories().then((cats) => {
      setCategories(cats);
      if (cats.length > 0) setCategoryId(cats[0].id);
    });
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setImageFiles((prev) => [...prev, ...files]);

    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeFile = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const addExternalImageUrl = () => {
    if (newImageUrl.trim()) {
      setExternalImageUrls((prev) => [...prev, newImageUrl.trim()]);
      setNewImageUrl("");
    }
  };

  const removeExternalUrl = (index: number) => {
    setExternalImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validations
    if (!name.trim()) return setError("Product name is required.");
    if (!sku.trim()) return setError("SKU is required.");
    if (!categoryId) return setError("Please select a category.");

    const numSelling = Number(sellingPrice);
    const numCost = Number(costPrice);
    const numStock = Number(stockQuantity);
    const numLowStock = Number(lowStockThreshold);
    const numDiscount = discountPrice !== "" ? Number(discountPrice) : undefined;

    if (isNaN(numSelling) || numSelling < 0) return setError("Selling price must be 0 or greater.");
    if (isNaN(numCost) || numCost < 0) return setError("Cost price must be 0 or greater.");
    if (isNaN(numStock) || numStock < 0) return setError("Stock quantity must be 0 or greater.");
    if (numDiscount !== undefined) {
      if (isNaN(numDiscount) || numDiscount < 0) return setError("Discount price cannot be negative.");
      if (numDiscount > numSelling) return setError("Discount price cannot exceed regular selling price.");
    }

    setLoading(true);
    try {
      // 1. Upload any uploaded files to Firebase Storage
      const uploadedUrls: string[] = [];
      const tempId = `prod_${Date.now()}`;

      for (const file of imageFiles) {
        const url = await productService.uploadProductImage(tempId, file);
        uploadedUrls.push(url);
      }

      const allImages = [...uploadedUrls, ...externalImageUrls];
      const selectedCat = categories.find((c) => c.id === categoryId);

      const productPayload = {
        name: name.trim(),
        slug: slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        sku: sku.trim().toUpperCase(),
        brand: brand.trim(),
        categoryId,
        categoryName: selectedCat?.name || "General",
        shortDescription: shortDescription.trim(),
        description: description.trim(),
        sellingPrice: numSelling,
        costPrice: numCost,
        discountPrice: numDiscount,
        stockQuantity: numStock,
        lowStockThreshold: numLowStock || 5,
        status,
        featured,
        images: allImages.length > 0 ? allImages : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80"],
        variants: [],
        attributes: [],
        weight: weight !== "" ? Number(weight) : undefined,
        color: color.trim() || undefined,
        size: size.trim() || undefined,
      };

      await productService.createProduct(
        productPayload,
        adminProfile?.uid || "admin",
        adminProfile?.displayName || "Administrator"
      );

      router.push("/admin/products");
    } catch (err: any) {
      console.error("Failed to create product:", err);
      setError(err.message || "Failed to create product.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link href="/admin/products">
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Add New Product</h1>
            <p className="text-xs text-slate-500">Create a merchandise record in Cloud Firestore</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">General Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Product Name *"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Wireless Noise-Cancelling Headphones"
                required
              />
              <Input
                label="SKU (Stock Keeping Unit) *"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. AUD-HD-001"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="URL Slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto-generated-slug"
              />
              <Input
                label="Brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. AuraSound"
              />
              <Select
                label="Category *"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <Input
              label="Short Description"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Brief tagline for listings and search summaries"
            />

            <Textarea
              label="Full Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Comprehensive product specifications, features, warranty, and care instructions..."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Pricing & Financials */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pricing & Profitability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Regular Selling Price (₹) *"
                type="number"
                min="0"
                step="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value === "" ? "" : Number(e.target.value))}
                required
              />
              <Input
                label="Discount Price (₹, optional)"
                type="number"
                min="0"
                step="0.01"
                value={discountPrice}
                onChange={(e) => setDiscountPrice(e.target.value === "" ? "" : Number(e.target.value))}
                helperText="Must be lower than selling price"
              />
              <Input
                label="Cost Price (₹) *"
                type="number"
                min="0"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value === "" ? "" : Number(e.target.value))}
                helperText="Used to compute real profit metrics"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Inventory Automation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Stock & Inventory Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Stock Quantity *"
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                helperText="Initial stock level. Automatically decrements upon sales."
                required
              />
              <Input
                label="Low Stock Alert Threshold"
                type="number"
                min="1"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value === "" ? "" : Number(e.target.value))}
                helperText="Triggers admin notification when stock drops to or below this level"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <Select
                label="Publication Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductStatus)}
              >
                <option value="active">Active (Visible in Store)</option>
                <option value="draft">Draft (Hidden)</option>
                <option value="inactive">Inactive</option>
              </Select>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="featured"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
                <label htmlFor="featured" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Feature on Storefront Homepage
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Media / Images */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Product Images (Firebase Storage)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors">
              <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">Upload to Firebase Storage</p>
              <p className="text-[11px] text-slate-500 mt-0.5">PNG, JPG, WEBP up to 5MB</p>
              <label className="mt-3 inline-block">
                <span className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer hover:bg-slate-800">
                  Select Files
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* URL input fallback */}
            <div className="flex gap-2">
              <Input
                placeholder="Or paste an image URL (e.g. Unsplash)..."
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
              />
              <Button type="button" variant="outline" size="sm" onClick={addExternalImageUrl}>
                Add URL
              </Button>
            </div>

            {/* Image Previews */}
            {(imagePreviews.length > 0 || externalImageUrls.length > 0) && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 pt-2">
                {imagePreviews.map((url, idx) => (
                  <div key={`file-${idx}`} className="relative group aspect-square rounded-lg overflow-hidden border">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute top-1 right-1 h-5 w-5 bg-rose-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {externalImageUrls.map((url, idx) => (
                  <div key={`url-${idx}`} className="relative group aspect-square rounded-lg overflow-hidden border">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeExternalUrl(idx)}
                      className="absolute top-1 right-1 h-5 w-5 bg-rose-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Link href="/admin/products">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" loading={loading} className="bg-slate-900 hover:bg-slate-800">
            <Save className="mr-1.5 h-4 w-4" />
            Save & Publish Product
          </Button>
        </div>
      </form>
    </div>
  );
}
