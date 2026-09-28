export type AdminRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "sales_manager"
  | "inventory_manager"
  | "viewer";

export type Permission =
  | "products.read"
  | "products.create"
  | "products.update"
  | "products.delete"
  | "categories.read"
  | "categories.create"
  | "categories.update"
  | "categories.delete"
  | "orders.read"
  | "orders.update"
  | "orders.refund"
  | "inventory.read"
  | "inventory.update"
  | "sales.read"
  | "reports.read"
  | "customers.read"
  | "coupons.read"
  | "coupons.create"
  | "coupons.update"
  | "coupons.delete"
  | "payments.read"
  | "notifications.read"
  | "audit.read"
  | "settings.read"
  | "settings.update"
  | "admins.manage";

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
  permissions: Permission[];
  photoURL?: string;
  phoneNumber?: string;
  active: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  super_admin: [
    "products.read",
    "products.create",
    "products.update",
    "products.delete",
    "categories.read",
    "categories.create",
    "categories.update",
    "categories.delete",
    "orders.read",
    "orders.update",
    "orders.refund",
    "inventory.read",
    "inventory.update",
    "sales.read",
    "reports.read",
    "customers.read",
    "coupons.read",
    "coupons.create",
    "coupons.update",
    "coupons.delete",
    "payments.read",
    "notifications.read",
    "audit.read",
    "settings.read",
    "settings.update",
    "admins.manage",
  ],
  admin: [
    "products.read",
    "products.create",
    "products.update",
    "products.delete",
    "categories.read",
    "categories.create",
    "categories.update",
    "categories.delete",
    "orders.read",
    "orders.update",
    "orders.refund",
    "inventory.read",
    "inventory.update",
    "sales.read",
    "reports.read",
    "customers.read",
    "coupons.read",
    "coupons.create",
    "coupons.update",
    "coupons.delete",
    "payments.read",
    "notifications.read",
    "audit.read",
    "settings.read",
    "settings.update",
  ],
  manager: [
    "products.read",
    "products.create",
    "products.update",
    "categories.read",
    "categories.create",
    "categories.update",
    "orders.read",
    "orders.update",
    "inventory.read",
    "inventory.update",
    "sales.read",
    "reports.read",
    "customers.read",
    "coupons.read",
    "coupons.create",
    "payments.read",
    "notifications.read",
  ],
  sales_manager: [
    "products.read",
    "categories.read",
    "orders.read",
    "orders.update",
    "orders.refund",
    "sales.read",
    "reports.read",
    "customers.read",
    "coupons.read",
    "payments.read",
    "notifications.read",
  ],
  inventory_manager: [
    "products.read",
    "products.create",
    "products.update",
    "categories.read",
    "inventory.read",
    "inventory.update",
    "notifications.read",
  ],
  viewer: [
    "products.read",
    "categories.read",
    "orders.read",
    "inventory.read",
    "sales.read",
    "reports.read",
    "customers.read",
    "coupons.read",
    "payments.read",
    "notifications.read",
    "settings.read",
  ],
};
