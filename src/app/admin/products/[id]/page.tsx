"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { productService } from "@/features/products/productService";
import { categoryService } from "@/features/categories/categoryService";
import { useAuth } from "@/features/auth/AuthContext";
import { Product, Category, ProductStatus } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { ArrowLeft, Upload, X, AlertCircle, Save, Loader2 } from "lucide-react";

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const { adminProfile } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Product fields
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
  const [stockQuantity, setStockQuantity] = useState<number | "">(0);
  const [lowStockThreshold, setLowStockThreshold] = useState<number | "">(5);
  const [status, setStatus] = useState<ProductStatus>("active");
  const [featured, setFeatured] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [prod, cats] = await Promise.all([
          productService.getProduct(productId),
          categoryService.getCategories(),
        ]);
        setCategories(cats);

        if (prod) {
          setName(prod.name);
          setSlug(prod.slug);
          setSku(prod.sku);
          setBrand(prod.brand || "");
          setCategoryId(prod.categoryId);
          setShortDescription(prod.shortDescription || "");
          setDescription(prod.description || "");
          setCostPrice(prod.costPrice);
          setSellingPrice(prod.sellingPrice);
          setDiscountPrice(prod.discountPrice ?? "");
          setStockQuantity(prod.stockQuantity);
          setLowStockThreshold(prod.lowStockThreshold || 5);
          setStatus(prod.status);
          setFeatured(prod.featured || false);
          setImages(prod.images || []);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load product");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [productId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const file = e.target.files[0];
    try {
      const url = await productService.uploadProductImage(productId, file);
      setImages((prev) => [...prev, url]);
    } catch (err: any) {
      alert("Image upload error: " + err.message);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const addImageUrl = () => {
    if (newImageUrl.trim()) {
      setImages((prev) => [...prev, newImageUrl.trim()]);
      setNewImageUrl("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const numSelling = Number(sellingPrice);
    const numCost = Number(costPrice);
    const numStock = Number(stockQuantity);
    const numLowStock = Number(lowStockThreshold);
    const numDiscount = discountPrice !== "" ? Number(discountPrice) : undefined;

    if (isNaN(numSelling) || numSelling < 0) return setError("Selling price must be 0 or greater.");
    if (isNaN(numCost) || numCost < 0) return setError("Cost price must be 0 or greater.");
    if (isNaN(numStock) || numStock < 0) return setError("Stock quantity must be 0 or greater.");
    if (numDiscount !== undefined && numDiscount > numSelling) {
      return setError("Discount price cannot exceed selling price.");
    }

    setSaving(true);
    try {
      const selectedCat = categories.find((c) => c.id === categoryId);

      const updates: Partial<Product> = {
        name: name.trim(),
        slug: slug.trim(),
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
        images,
      };

      await productService.updateProduct(
        productId,
        updates,
        adminProfile?.uid || "admin",
        adminProfile?.displayName || "Administrator"
      );

      router.push("/admin/products");
    } catch (err: any) {
      setError(err.message || "Failed to update product.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-800" />
      </div>
    );
  }

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
            <h1 className="text-xl font-bold text-slate-900">Edit Product</h1>
            <p className="text-xs text-slate-500">Updating product ID: {productId}</p>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Product Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Product Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input label="SKU" value={sku} onChange={(e) => setSku(e.target.value)} required />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="URL Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
              <Input label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
              <Select
                label="Category"
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
            />

            <Textarea
              label="Full Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pricing & Stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Selling Price (₹)"
                type="number"
                min="0"
                step="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value === "" ? "" : Number(e.target.value))}
                required
              />
              <Input
                label="Discount Price (₹)"
                type="number"
                min="0"
                step="0.01"
                value={discountPrice}
                onChange={(e) => setDiscountPrice(e.target.value === "" ? "" : Number(e.target.value))}
              />
              <Input
                label="Cost Price (₹)"
                type="number"
                min="0"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value === "" ? "" : Number(e.target.value))}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Current Stock"
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                required
              />
              <Input
                label="Low Stock Threshold"
                type="number"
                min="1"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <Select
                label="Publication Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductStatus)}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
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

        {/* Media */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Images</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Add image URL..."
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
              />
              <Button type="button" variant="outline" size="sm" onClick={addImageUrl}>
                Add
              </Button>
              <label className="shrink-0">
                <span className="inline-flex items-center h-10 px-3 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Upload
                </span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 pt-2">
                {images.map((url, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
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

        <div className="flex justify-end gap-3 pt-4">
          <Link href="/admin/products">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" loading={saving} className="bg-slate-900 hover:bg-slate-800">
            <Save className="mr-1.5 h-4 w-4" />
            Update Product
          </Button>
        </div>
      </form>
    </div>
  );
}
