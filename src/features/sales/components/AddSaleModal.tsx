"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { productService } from "@/features/products/productService";
import { customerService } from "@/features/customers/customerService";
import { couponService } from "@/features/coupons/couponService";
import { salesService } from "@/features/sales/salesService";
import { Product, Customer, PaymentMethod, PaymentStatus, OrderStatus, CreateOrderPayload } from "@/types";
import { formatCurrency } from "@/lib/utils/cn";
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle2,
  Receipt,
  ExternalLink,
  AlertCircle,
  Loader2,
  Tag,
  Check,
  Building,
} from "lucide-react";

interface AddSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaleCreated: () => void;
}

interface SaleCartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export function AddSaleModal({ isOpen, onClose, onSaleCreated }: AddSaleModalProps) {
  // Catalog & Customer lists
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Selected item state for adding
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [addQuantity, setAddQuantity] = useState<number>(1);

  // Sale cart items
  const [cart, setCart] = useState<SaleCartItem[]>([]);

  // Customer Mode: "walkin" | "existing" | "custom"
  const [customerMode, setCustomerMode] = useState<"walkin" | "existing" | "custom">("walkin");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  // Customer Details Form
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerEmail, setCustomerEmail] = useState("counter@store.local");
  const [customerPhone, setCustomerPhone] = useState("+91 98000 00000");
  const [address, setAddress] = useState("In-Store Counter / Direct Sale");
  const [city, setCity] = useState("Bengaluru");
  const [state, setState] = useState("Karnataka");
  const [pinCode, setPinCode] = useState("560001");

  // Payment & Order Options
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
  const [orderStatus, setOrderStatus] = useState<OrderStatus>("delivered");
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0);
  const [salesNotes, setSalesNotes] = useState<string>("Counter sale by Admin");

  // Coupon / Discount state
  const [couponCode, setCouponCode] = useState<string>("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState<boolean>(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Submission & Success state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<{
    orderId: string;
    orderNumber: string;
    total: number;
  } | null>(null);

  // Load products & customers when modal opens
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      resetForm();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    setLoadingData(true);
    try {
      const [prodRes, custList] = await Promise.all([
        productService.getProducts({ status: "active", limit: 100 }),
        customerService.getCustomers(),
      ]);
      setProducts(prodRes.products || []);
      setCustomers(custList || []);
      if (prodRes.products?.length > 0) {
        setSelectedProductId(prodRes.products[0].id);
      }
    } catch (e) {
      console.error("Failed to load initial sales data:", e);
    } finally {
      setLoadingData(false);
    }
  };

  const resetForm = () => {
    setCart([]);
    setCustomerMode("walkin");
    setWalkInDetails();
    setPaymentMethod("cod");
    setPaymentStatus("paid");
    setOrderStatus("delivered");
    setDeliveryCharge(0);
    setSalesNotes("Direct in-store counter sale");
    setCouponCode("");
    setAppliedCoupon(null);
    setCouponError(null);
    setError(null);
    setCreatedOrder(null);
  };

  const setWalkInDetails = () => {
    setCustomerName("Walk-in Customer");
    setCustomerEmail("counter@store.local");
    setCustomerPhone("+91 98000 00000");
    setAddress("In-Store Counter / Direct Sale");
    setCity("Bengaluru");
    setState("Karnataka");
    setPinCode("560001");
  };

  const handleCustomerModeChange = (mode: "walkin" | "existing" | "custom") => {
    setCustomerMode(mode);
    setError(null);
    if (mode === "walkin") {
      setWalkInDetails();
      setSelectedCustomerId("");
    } else if (mode === "existing") {
      if (customers.length > 0) {
        handleSelectCustomer(customers[0].id);
      }
    } else {
      setSelectedCustomerId("");
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setAddress("");
      setCity("");
      setState("");
      setPinCode("");
    }
  };

  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    const found = customers.find((c) => c.id === id);
    if (found) {
      setCustomerName(found.name || "");
      setCustomerEmail(found.email || "");
      setCustomerPhone(found.phone || "");
      setAddress(found.address || "Customer address");
      setCity(found.city || "Bengaluru");
      setState(found.state || "Karnataka");
      setPinCode(found.pinCode || "560001");
    }
  };

  // Cart operations
  const handleAddItem = () => {
    setError(null);
    if (!selectedProductId) return;
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    if (prod.stockQuantity <= 0) {
      setError(`"${prod.name}" is currently out of stock.`);
      return;
    }

    const price =
      prod.discountPrice && prod.discountPrice > 0 ? prod.discountPrice : prod.sellingPrice;

    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.product.id === prod.id);
      if (existingIdx > -1) {
        const currentQty = prev[existingIdx].quantity;
        const newQty = Math.min(prod.stockQuantity, currentQty + addQuantity);
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty,
        };
        return updated;
      }
      return [
        ...prev,
        {
          product: prod,
          quantity: Math.min(prod.stockQuantity, Math.max(1, addQuantity)),
          unitPrice: price,
        },
      ];
    });

    setAddQuantity(1);
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.product.stockQuantity) {
              setError(`Maximum available stock for ${item.product.name} is ${item.product.stockQuantity}`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as SaleCartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Financial Calculations
  const grossSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;
  const taxableSubtotal = Math.max(0, grossSubtotal - couponDiscount);
  const tax = Number((taxableSubtotal * 0.18).toFixed(2));
  const finalTotal = Number((taxableSubtotal + tax + Number(deliveryCharge || 0)).toFixed(2));

  // Coupon handling
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const res = await couponService.validateCoupon(
        couponCode.trim(),
        grossSubtotal,
        selectedCustomerId || undefined
      );
      if (res.valid && res.discountAmount) {
        setAppliedCoupon({ code: couponCode.trim().toUpperCase(), discount: res.discountAmount });
        setCouponError(null);
      } else {
        setCouponError(res.message || "Invalid or inapplicable coupon.");
        setAppliedCoupon(null);
      }
    } catch {
      setCouponError("Could not validate coupon at this time.");
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);
  };

  // Submit Sale
  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (cart.length === 0) {
      setError("Please add at least one product to the sale.");
      return;
    }

    if (!customerName.trim() || !customerPhone.trim() || !customerEmail.trim() || !address.trim()) {
      setError("Please fill in all required customer details.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateOrderPayload = {
        customerId: selectedCustomerId || undefined,
        customerSnapshot: {
          name: customerName.trim(),
          email: customerEmail.trim(),
          phone: customerPhone.trim(),
          address: address.trim(),
          city: city.trim() || "Bengaluru",
          state: state.trim() || "Karnataka",
          pinCode: pinCode.trim() || "560001",
          notes: salesNotes.trim(),
        },
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        paymentMethod,
        paymentStatus,
        orderStatus,
        deliveryChargeOverride: Number(deliveryCharge || 0),
        notes: salesNotes.trim() || `In-store counter sale via ${paymentMethod.toUpperCase()}`,
      };

      const result = await salesService.recordSale(payload);

      setCreatedOrder({
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        total: result.total,
      });

      // Notify parent to refresh sales metrics and charts
      onSaleCreated();
    } catch (err: any) {
      console.error("Sale recording failed:", err);
      setError(err?.message || "Failed to record sale. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentlySelectedProduct = products.find((p) => p.id === selectedProductId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Direct Sale"
      description="Create a counter or in-store sale with automated inventory deduction and ledger synchronization"
      maxWidth="4xl"
    >
      {createdOrder ? (
        /* Order Success View */
        <div className="py-6 px-2 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-900">Sale Successfully Recorded!</h3>
            <p className="text-xs text-slate-500">
              Inventory was updated, sales aggregates calculated, and financial ledger synchronized.
            </p>
          </div>

          <div className="mx-auto max-w-sm rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-left space-y-2 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 font-semibold">
              <span className="text-slate-600">Order Reference:</span>
              <span className="font-mono text-indigo-600 font-bold">{createdOrder.orderNumber}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Customer:</span>
              <span className="font-semibold text-slate-800">{customerName}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Payment Method:</span>
              <span className="uppercase font-semibold text-slate-800">{paymentMethod}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Payment Status:</span>
              <Badge variant={paymentStatus === "paid" ? "success" : "warning"}>
                {paymentStatus.toUpperCase()}
              </Badge>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm font-extrabold text-slate-900">
              <span>Total Received:</span>
              <span className="text-emerald-600 text-base">{formatCurrency(createdOrder.total)}</span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href={`/invoice/${createdOrder.orderId}`} target="_blank">
              <Button variant="outline" size="sm" className="gap-1.5 border-slate-300">
                <Receipt className="h-4 w-4 text-indigo-600" />
                View & Print Invoice
                <ExternalLink className="h-3 w-3 text-slate-400" />
              </Button>
            </Link>

            <Link href={`/admin/orders/${createdOrder.orderId}`}>
              <Button variant="outline" size="sm" className="gap-1.5 border-slate-300">
                View Full Order Details
              </Button>
            </Link>

            <Button size="sm" onClick={resetForm} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Plus className="h-4 w-4 mr-1" />
              Record Another Sale
            </Button>
          </div>
        </div>
      ) : (
        /* Sale Entry Form */
        <form onSubmit={handleSubmitSale} className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Customer Details */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  1. Customer Information
                </h4>
              </div>

              {/* Mode switch */}
              <div className="flex items-center gap-1.5 bg-slate-200/60 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => handleCustomerModeChange("walkin")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    customerMode === "walkin"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Walk-in / Counter
                </button>
                <button
                  type="button"
                  onClick={() => handleCustomerModeChange("existing")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    customerMode === "existing"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Existing Customer
                </button>
                <button
                  type="button"
                  onClick={() => handleCustomerModeChange("custom")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    customerMode === "custom"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  New Customer
                </button>
              </div>
            </div>

            {customerMode === "existing" && (
              <div className="pt-1">
                <Select
                  label="Select Registered Customer"
                  value={selectedCustomerId}
                  onChange={(e) => handleSelectCustomer(e.target.value)}
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone || c.email}) - {c.totalOrders || 0} orders
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <Input
                label="Customer Name *"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Jane Doe"
                required
              />
              <Input
                label="Phone Number *"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+91 98765 43210"
                required
              />
              <Input
                label="Email Address *"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
                required
              />
            </div>

            {customerMode !== "walkin" && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                <div className="sm:col-span-2">
                  <Input
                    label="Shipping / Billing Address *"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, locality, landmark"
                    required
                  />
                </div>
                <Input
                  label="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
                <Input
                  label="PIN Code"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="560001"
                />
              </div>
            )}
          </div>

          {/* Section 2: Product Selection & Cart */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-indigo-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  2. Select Products & Quantities
                </h4>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                {cart.length} item(s) selected
              </span>
            </div>

            {/* Product selection bar */}
            <div className="flex flex-col sm:flex-row items-end gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
              <div className="flex-1 w-full">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Product from Catalog
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all cursor-pointer"
                  disabled={loadingData}
                >
                  {products.map((p) => {
                    const price = p.discountPrice && p.discountPrice > 0 ? p.discountPrice : p.sellingPrice;
                    return (
                      <option key={p.id} value={p.id} disabled={p.stockQuantity <= 0}>
                        {p.name} — {formatCurrency(price)} ({p.stockQuantity > 0 ? `${p.stockQuantity} in stock` : "OUT OF STOCK"})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="w-24 shrink-0">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Qty
                </label>
                <input
                  type="number"
                  min="1"
                  max={currentlySelectedProduct?.stockQuantity || 1}
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-center focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <Button
                type="button"
                onClick={handleAddItem}
                disabled={!selectedProductId || (currentlySelectedProduct?.stockQuantity || 0) <= 0}
                className="bg-slate-900 hover:bg-slate-800 text-white shrink-0 h-10 text-xs font-semibold px-4"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Item
              </Button>
            </div>

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="py-6 text-center border-2 border-dashed border-slate-200 rounded-xl">
                <ShoppingBag className="mx-auto h-8 w-8 text-slate-300 mb-1.5" />
                <p className="text-xs font-semibold text-slate-600">Cart is empty</p>
                <p className="text-[11px] text-slate-400">Choose a product above and click Add Item</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Item Details</th>
                      <th className="py-2.5 px-3 text-right">Price</th>
                      <th className="py-2.5 px-3 text-center">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Line Total</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.map((item) => (
                      <tr key={item.product.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-slate-900">{item.product.name}</p>
                          <p className="text-[10px] text-slate-400">
                            SKU: {item.product.sku || "N/A"} • Stock: {item.product.stockQuantity}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.product.id, -1)}
                              className="h-6 w-6 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-7 text-center font-bold text-slate-800">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.product.id, 1)}
                              disabled={item.quantity >= item.product.stockQuantity}
                              className="h-6 w-6 rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center text-slate-700 transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Payment, Delivery, and Financial Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment & Settings */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <CreditCard className="h-4 w-4 text-indigo-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  3. Payment & Settlement
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                  >
                    <option value="cod">Cash / Cash In Hand</option>
                    <option value="upi">UPI / QR Code</option>
                    <option value="card">Credit / Debit Card</option>
                    <option value="netbanking">Bank Transfer / Netbanking</option>
                    <option value="wallet">Store Credit / Wallet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Payment Status
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                    className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                  >
                    <option value="paid">Paid (Settled)</option>
                    <option value="pending">Pending (To Collect)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Order Status
                  </label>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value as OrderStatus)}
                    className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                  >
                    <option value="delivered">Delivered / Handed Over</option>
                    <option value="confirmed">Confirmed (Processing)</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                <Input
                  label="Delivery / Fee (₹)"
                  type="number"
                  min="0"
                  value={deliveryCharge}
                  onChange={(e) => setDeliveryCharge(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0"
                />
              </div>

              {/* Coupon Code input */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Apply Promotional Coupon
                </label>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                      <Tag className="h-3.5 w-3.5" />
                      <span>{appliedCoupon.code}</span>
                      <span className="text-emerald-600 font-normal">
                        (-{formatCurrency(appliedCoupon.discount)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="e.g. WELCOME10"
                      className="flex-1 h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs uppercase placeholder:normal-case font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleApplyCoupon}
                      disabled={validatingCoupon || !couponCode.trim() || grossSubtotal === 0}
                      className="h-9 px-3 text-xs"
                    >
                      {validatingCoupon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                )}
                {couponError && <p className="text-[11px] text-rose-600 mt-1">{couponError}</p>}
              </div>

              {/* Order Memo */}
              <div className="pt-1">
                <Input
                  label="Sales Memo / Notes"
                  value={salesNotes}
                  onChange={(e) => setSalesNotes(e.target.value)}
                  placeholder="e.g. In-store counter sale, direct payment"
                />
              </div>
            </div>

            {/* Bill Summary Card */}
            <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Banknote className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Bill Calculation
                  </h4>
                </div>

                <div className="space-y-2.5 py-3 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Items Subtotal:</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(grossSubtotal)}</span>
                  </div>

                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount ({appliedCoupon?.code}):</span>
                      <span className="font-semibold">-{formatCurrency(couponDiscount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-600">
                    <span>Estimated GST (18%):</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(tax)}</span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Delivery / Service Charge:</span>
                    <span className="font-semibold text-slate-900">
                      {deliveryCharge > 0 ? formatCurrency(deliveryCharge) : "FREE"}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
                    <div>
                      <span className="text-sm font-extrabold text-slate-900 block">Total Due</span>
                      <span className="text-[10px] text-slate-400">Net payable after tax</span>
                    </div>
                    <span className="text-2xl font-black text-slate-900 tracking-tight">
                      {formatCurrency(finalTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting || cart.length === 0}
                  className="flex-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-500/20"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Recording Sale...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-1.5" />
                      Record Sale • {formatCurrency(finalTotal)}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
