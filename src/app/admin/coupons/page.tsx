"use client";

import React, { useState, useEffect } from "react";
import { couponService } from "@/features/coupons/couponService";
import { useAuth } from "@/features/auth/AuthContext";
import { Coupon, CouponType } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { EmptyState } from "@/components/ui/Select";
import {
  Ticket,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Percent,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

export default function CouponsPage() {
  const { adminProfile, hasPermission } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [code, setCode] = useState("");
  const [type, setType] = useState<CouponType>("percentage");
  const [value, setValue] = useState<number | "">(10);
  const [minimumOrderAmount, setMinimumOrderAmount] = useState<number | "">(1000);
  const [maximumDiscount, setMaximumDiscount] = useState<number | "">("");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [expiryDate, setExpiryDate] = useState("2027-12-31");
  const [usageLimit, setUsageLimit] = useState<number | "">(1000);
  const [perCustomerLimit, setPerCustomerLimit] = useState<number | "">(1);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Deletion
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const data = await couponService.getCoupons();
      setCoupons(data);
    } catch (e) {
      console.error("Coupons load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCoupon(null);
    setCode("");
    setType("percentage");
    setValue(10);
    setMinimumOrderAmount(1000);
    setMaximumDiscount("");
    setStartDate(new Date().toISOString().slice(0, 10));
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setExpiryDate(nextYear.toISOString().slice(0, 10));
    setUsageLimit(500);
    setPerCustomerLimit(1);
    setActive(true);
    setError("");
    setIsModalOpen(true);
  };

  const openEditModal = (c: Coupon) => {
    setEditingCoupon(c);
    setCode(c.code);
    setType(c.type);
    setValue(c.value);
    setMinimumOrderAmount(c.minimumOrderAmount);
    setMaximumDiscount(c.maximumDiscount ?? "");
    setStartDate(c.startDate?.slice(0, 10) || "");
    setExpiryDate(c.expiryDate?.slice(0, 10) || "");
    setUsageLimit(c.usageLimit);
    setPerCustomerLimit(c.perCustomerLimit);
    setActive(c.active);
    setError("");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return setError("Coupon code is required.");
    const numVal = Number(value);
    if (isNaN(numVal) || numVal <= 0) return setError("Discount value must be greater than 0.");
    if (type === "percentage" && numVal > 100) return setError("Percentage cannot exceed 100%.");

    setSaving(true);
    setError("");
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        type,
        value: numVal,
        minimumOrderAmount: Number(minimumOrderAmount) || 0,
        maximumDiscount: maximumDiscount !== "" ? Number(maximumDiscount) : undefined,
        startDate: new Date(startDate).toISOString(),
        expiryDate: new Date(expiryDate).toISOString(),
        usageLimit: Number(usageLimit) || 0,
        perCustomerLimit: Number(perCustomerLimit) || 1,
        active,
      };

      if (editingCoupon) {
        await couponService.updateCoupon(
          editingCoupon.id,
          payload,
          adminProfile?.uid || "admin",
          adminProfile?.displayName || "Administrator"
        );
      } else {
        await couponService.createCoupon(
          payload,
          adminProfile?.uid || "admin",
          adminProfile?.displayName || "Administrator"
        );
      }

      setIsModalOpen(false);
      loadCoupons();
    } catch (err: any) {
      setError(err.message || "Failed to save coupon.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await couponService.deleteCoupon(
        deleteTarget.id,
        adminProfile?.uid || "admin",
        adminProfile?.displayName || "Administrator"
      );
      setDeleteTarget(null);
      loadCoupons();
    } catch (err: any) {
      alert("Error deleting coupon: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Promotions & Coupons</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure automated customer discounts, usage limitations, and validity spans
          </p>
        </div>

        {hasPermission("coupons.create") && (
          <Button size="sm" onClick={openCreateModal}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Create Coupon
          </Button>
        )}
      </div>

      {/* Coupons Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading coupon records...</div>
        ) : coupons.length === 0 ? (
          <EmptyState
            title="No Coupons Configured"
            description="Create promotional discounts for customers or seed the demo coupons (WELCOME10, FLAT500)."
            actionLabel="Create Coupon"
            onAction={openCreateModal}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 uppercase font-semibold">
                  <th className="py-3 px-4">Coupon Code</th>
                  <th className="py-3 px-4">Discount</th>
                  <th className="py-3 px-4">Min Order</th>
                  <th className="py-3 px-4">Validity Period</th>
                  <th className="py-3 px-4 text-center">Usage</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coupons.map((c) => {
                  const isExpired = new Date(c.expiryDate).getTime() < Date.now();

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded">
                          {c.code}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {c.type === "percentage" ? `${c.value}% Off` : `₹${c.value} Off`}
                        {c.maximumDiscount && (
                          <span className="text-[10px] text-slate-500 block font-normal">
                            Max: ₹{c.maximumDiscount}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {c.minimumOrderAmount > 0 ? `₹${c.minimumOrderAmount}` : "None"}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {formatDate(c.startDate)} to {formatDate(c.expiryDate)}
                        {isExpired && <span className="text-[10px] text-rose-600 block font-semibold">Expired</span>}
                      </td>

                      <td className="py-3 px-4 text-center font-medium">
                        {c.usedCount} / {c.usageLimit > 0 ? c.usageLimit : "∞"}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <Badge variant={c.active && !isExpired ? "success" : "danger"}>
                          {c.active && !isExpired ? "Active" : isExpired ? "Expired" : "Inactive"}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-right space-x-1">
                        {hasPermission("coupons.update") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-600"
                            onClick={() => openEditModal(c)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {hasPermission("coupons.delete") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => setDeleteTarget(c)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Coupon Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCoupon ? "Edit Coupon" : "Create New Coupon"}
        description="Configure promotional rules and automated validation"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Coupon Code *"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. WELCOME10"
              required
            />
            <Select
              label="Discount Type *"
              value={type}
              onChange={(e) => setType(e.target.value as CouponType)}
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (₹)</option>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Value *"
              type="number"
              min="0.1"
              step="0.1"
              value={value}
              onChange={(e) => setValue(e.target.value === "" ? "" : Number(e.target.value))}
              required
            />
            <Input
              label="Min Order (₹)"
              type="number"
              min="0"
              value={minimumOrderAmount}
              onChange={(e) => setMinimumOrderAmount(e.target.value === "" ? "" : Number(e.target.value))}
            />
            <Input
              label="Max Discount (₹)"
              type="number"
              min="0"
              value={maximumDiscount}
              onChange={(e) => setMaximumDiscount(e.target.value === "" ? "" : Number(e.target.value))}
              helperText="Only for percentage"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              label="Expiry Date"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Total Usage Limit (0 = ∞)"
              type="number"
              min="0"
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value === "" ? "" : Number(e.target.value))}
            />
            <Input
              label="Limit Per Customer"
              type="number"
              min="1"
              value={perCustomerLimit}
              onChange={(e) => setPerCustomerLimit(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="couponActive"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
            />
            <label htmlFor="couponActive" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Active promotion
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={saving} className="bg-slate-900">
              {editingCoupon ? "Update Coupon" : "Save Coupon"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Coupon"
        message={`Are you sure you want to delete coupon "${deleteTarget?.code}"?`}
        confirmLabel="Delete Coupon"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
