export type ProductStatus = "active" | "inactive" | "draft" | "archived";

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  costPrice?: number;
  stockQuantity: number;
  attributes: Record<string, string>;
  image?: string;
}

export interface ProductAttribute {
  name: string;
  values: string[];
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  shortDescription?: string;
  categoryId: string;
  categoryName?: string;
  subcategoryId?: string;
  subcategoryName?: string;
  brand?: string;
  costPrice: number;
  sellingPrice: number;
  discountPrice?: number;
  stockQuantity: number;
  lowStockThreshold: number;
  status: ProductStatus;
  featured: boolean;
  images: string[];
  variants: ProductVariant[];
  attributes: ProductAttribute[];
  size?: string;
  color?: string;
  weight?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFilterOptions {
  search?: string;
  categoryId?: string;
  status?: ProductStatus | "all";
  stockFilter?: "all" | "in_stock" | "low_stock" | "out_of_stock";
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "name" | "sellingPrice" | "stockQuantity" | "createdAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}
