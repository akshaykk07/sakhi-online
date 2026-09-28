export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string | null;
  active: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDeleteAction {
  target: "uncategorized" | "reassign";
  reassignCategoryId?: string;
}
