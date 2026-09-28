"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/features/auth/AuthContext";
import {
  LayoutDashboard,
  Package,
  Layers,
  ShoppingBag,
  TrendingUp,
  Users,
  Boxes,
  Ticket,
  CreditCard,
  BarChart3,
  Bell,
  Settings,
  History,
  Store,
  ChevronRight,
  ShieldCheck,
  X,
} from "lucide-react";

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { adminProfile, hasPermission } = useAuth();

  const navItems = [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, permission: null },
    { label: "Products", href: "/admin/products", icon: Package, permission: "products.read" },
    { label: "Categories", href: "/admin/categories", icon: Layers, permission: "categories.read" },
    { label: "Orders", href: "/admin/orders", icon: ShoppingBag, permission: "orders.read" },
    { label: "Sales", href: "/admin/sales", icon: TrendingUp, permission: "sales.read" },
    { label: "Customers", href: "/admin/customers", icon: Users, permission: "customers.read" },
    { label: "Inventory", href: "/admin/inventory", icon: Boxes, permission: "inventory.read" },
    { label: "Coupons", href: "/admin/coupons", icon: Ticket, permission: "coupons.read" },
    { label: "Payments", href: "/admin/payments", icon: CreditCard, permission: "payments.read" },
    { label: "Reports", href: "/admin/reports", icon: BarChart3, permission: "reports.read" },
    { label: "Notifications", href: "/admin/notifications", icon: Bell, permission: "notifications.read" },
    { label: "Audit Logs", href: "/admin/audit-logs", icon: History, permission: "audit.read" },
    { label: "Settings", href: "/admin/settings", icon: Settings, permission: "settings.read" },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-slate-950 text-slate-300 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800/80">
          <Link href="/admin/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold shadow-md shadow-indigo-500/20">
              E
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white block">E-Shop Admin</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Enterprise Control</span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Storefront Simulator link */}
        <div className="px-4 py-3 border-b border-slate-800/60">
          <Link
            href="/store"
            target="_blank"
            className="flex items-center justify-between rounded-lg bg-indigo-950/60 border border-indigo-800/50 px-3 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Store className="h-4 w-4 text-indigo-400" />
              Live Customer Store
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            if (item.permission && !hasPermission(item.permission as any)) {
              return null;
            }

            const isActive =
              item.href === "/admin/dashboard"
                ? pathname === "/admin/dashboard"
                : pathname.startsWith(item.href);

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onClose()}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all group",
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                  )}
                />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Role Card */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-200 font-semibold text-xs border border-slate-700">
              {adminProfile?.displayName?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {adminProfile?.displayName || "Admin User"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                  {adminProfile?.role || "super_admin"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
