"use client";

import React, { useState, useEffect } from "react";
import { settingsService } from "@/features/settings/settingsService";
import { useAuth } from "@/features/auth/AuthContext";
import { BusinessSettings, DEFAULT_BUSINESS_SETTINGS, ROLE_PERMISSIONS, AdminRole } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import {
  Settings,
  Store,
  ShieldCheck,
  Key,
  Lock,
  Save,
  CheckCircle2,
  AlertCircle,
  Users,
} from "lucide-react";

export default function SettingsPage() {
  const { user, adminProfile, changePassword, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<"business" | "profile" | "roles">("business");

  // Business settings state
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [businessSuccess, setBusinessSuccess] = useState(false);
  const [businessError, setBusinessError] = useState("");

  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPass, setChangingPass] = useState(false);
  const [passSuccess, setPassSuccess] = useState(false);
  const [passError, setPassError] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await settingsService.getSettings();
      setSettings(data);
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBusiness(true);
    setBusinessError("");
    setBusinessSuccess(false);

    try {
      await settingsService.updateSettings(
        settings,
        adminProfile?.uid || "admin",
        adminProfile?.displayName || "Administrator"
      );
      setBusinessSuccess(true);
      setTimeout(() => setBusinessSuccess(false), 3000);
    } catch (err: any) {
      setBusinessError(err.message || "Failed to update business settings");
    } finally {
      setSavingBusiness(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError("");
    setPassSuccess(false);

    if (newPassword.length < 6) {
      return setPassError("Password must be at least 6 characters long.");
    }
    if (newPassword !== confirmPassword) {
      return setPassError("Passwords do not match.");
    }

    setChangingPass(true);
    try {
      await changePassword(newPassword);
      setPassSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPassError(err.message || "Failed to update password.");
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">System & Enterprise Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure business metadata, tax policies, currency defaults, and role-based access control
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("business")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
            activeTab === "business" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Store className="h-4 w-4" />
          Business & Store Policy
        </button>
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
            activeTab === "profile" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Lock className="h-4 w-4" />
          Admin Security & Password
        </button>
        <button
          onClick={() => setActiveTab("roles")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
            activeTab === "roles" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Users className="h-4 w-4" />
          Roles & Permission Matrix
        </button>
      </div>

      {/* Tab: Business Policy */}
      {activeTab === "business" && (
        <form onSubmit={handleSaveBusiness} className="space-y-6 max-w-4xl">
          {businessSuccess && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Business and financial policy settings updated successfully.</span>
            </div>
          )}

          {businessError && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{businessError}</span>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Store Legal Identity & Invoicing</CardTitle>
              <CardDescription className="text-xs">
                These values are stamped directly onto customer invoices and checkout estimates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Legal Business Name *"
                  value={settings.businessName}
                  onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                  required
                />
                <Input
                  label="GSTIN / Tax Registration Number *"
                  value={settings.gstNumber}
                  onChange={(e) => setSettings({ ...settings, gstNumber: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Support Email *"
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  required
                />
                <Input
                  label="Support Phone *"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  required
                />
              </div>

              <Input
                label="Registered Business Address *"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                required
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Financial Policies & Taxes</CardTitle>
              <CardDescription className="text-xs">
                Centralized rules used during automated checkout calculations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Currency Code"
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  placeholder="INR"
                />
                <Input
                  label="Currency Symbol"
                  value={settings.currencySymbol}
                  onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                  placeholder="₹"
                />
                <Input
                  label="Default GST / Tax Rate (%) *"
                  type="number"
                  min="0"
                  step="0.5"
                  value={settings.defaultTaxRate}
                  onChange={(e) => setSettings({ ...settings, defaultTaxRate: Number(e.target.value) })}
                  helperText="Applied automatically to taxable amount"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Base Delivery Charge (₹) *"
                  type="number"
                  min="0"
                  value={settings.deliveryCharge}
                  onChange={(e) => setSettings({ ...settings, deliveryCharge: Number(e.target.value) })}
                  required
                />
                <Input
                  label="Free Delivery Threshold (₹) *"
                  type="number"
                  min="0"
                  value={settings.freeDeliveryThreshold}
                  onChange={(e) => setSettings({ ...settings, freeDeliveryThreshold: Number(e.target.value) })}
                  helperText="Orders exceeding this subtotal qualify for free delivery"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <Input
                  label="Global Low Stock Threshold *"
                  type="number"
                  min="1"
                  value={settings.defaultLowStockThreshold}
                  onChange={(e) => setSettings({ ...settings, defaultLowStockThreshold: Number(e.target.value) })}
                  helperText="Triggers system-wide notification for low stock"
                  required
                />

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="autoConfirm"
                    checked={settings.autoConfirmOrders}
                    onChange={(e) => setSettings({ ...settings, autoConfirmOrders: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                  />
                  <label htmlFor="autoConfirm" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    Auto-confirm orders upon successful payment
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {hasPermission("settings.update") && (
            <div className="flex justify-end">
              <Button type="submit" loading={savingBusiness} className="bg-slate-900">
                <Save className="mr-1.5 h-4 w-4" />
                Save Business Settings
              </Button>
            </div>
          )}
        </form>
      )}

      {/* Tab: Security & Password */}
      {activeTab === "profile" && (
        <div className="max-w-xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Administrator Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-500">Name:</span>
                <span className="font-semibold text-slate-900">{adminProfile?.displayName}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-500">Email:</span>
                <span className="font-semibold text-slate-900">{user?.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-500">Assigned Role:</span>
                <Badge variant="default" className="capitalize">
                  {adminProfile?.role}
                </Badge>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">User UID:</span>
                <span className="font-mono text-slate-400">{user?.uid}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Change Password</CardTitle>
              <CardDescription className="text-xs">
                Update your Firebase Authentication credentials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                {passSuccess && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Your administrator password has been updated.</span>
                  </div>
                )}

                {passError && (
                  <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>{passError}</span>
                  </div>
                )}

                <Input
                  label="New Password"
                  type="password"
                  placeholder="••••••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />

                <Input
                  label="Confirm New Password"
                  type="password"
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />

                <Button type="submit" loading={changingPass} className="w-full bg-slate-900">
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Roles & Permission Matrix */}
      {activeTab === "roles" && (
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle className="text-sm">Role-Based Access Control (RBAC) Matrix</CardTitle>
            <CardDescription className="text-xs">
              System authorization permissions assigned per administrator role
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold uppercase">
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Allowed Permissions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(Object.keys(ROLE_PERMISSIONS) as AdminRole[]).map((r) => (
                    <tr key={r} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-bold text-slate-900 capitalize">
                        {r.replace("_", " ")}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {r === "super_admin"
                          ? "Full governance over products, finances, orders, roles, and settings."
                          : r === "admin"
                          ? "Full store operational controls except managing other super-admins."
                          : r === "manager"
                          ? "Catalog management, order fulfillment, and operational inventory."
                          : r === "sales_manager"
                          ? "Financial reviews, orders, customer profiles, and refunds."
                          : r === "inventory_manager"
                          ? "Stock adjustments, warehouse inventory transactions, and alerts."
                          : "Read-only access across reporting and orders."}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {ROLE_PERMISSIONS[r].map((perm) => (
                            <span
                              key={perm}
                              className="inline-block rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-700"
                            >
                              {perm}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
