"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { productService } from "@/features/products/productService";
import { orderService } from "@/features/orders/orderService";
import { couponService } from "@/features/coupons/couponService";
import { Product, Coupon } from "@/types";
import { formatCurrency } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Tag,
  CreditCard,
  Truck,
  Plus,
  Minus,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Check,
} from "lucide-react";

interface CartItem {
  product: Product;
  quantity: number;
}

export default function StorefrontPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);

  // Checkout form fields
  const [customerName, setCustomerName] = useState("Jane Doe");
  const [customerEmail, setCustomerEmail] = useState("jane.doe@example.com");
  const [customerPhone, setCustomerPhone] = useState("+91 98765 12345");
  const [address, setAddress] = useState("456 Greenwood Heights, Indiranagar");
  const [city, setCity] = useState("Bengaluru");
  const [state, setState] = useState("Karnataka");
  const [pinCode, setPinCode] = useState("560038");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "upi" | "cod">("card");

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponValidating, setCouponValidating] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await productService.getProducts({ status: "active", limit: 20 });
      setProducts(res.products);
    } catch (e) {
      console.error("Failed to load storefront products:", e);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    if (product.stockQuantity <= 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) return prev;
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.product.stockQuantity) return item;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const cartSubtotal = cart.reduce((sum, item) => {
    const price = item.product.discountPrice && item.product.discountPrice > 0 ? item.product.discountPrice : item.product.sellingPrice;
    return sum + price * item.quantity;
  }, 0);

  const deliveryCharge = cartSubtotal >= 1000 || cartSubtotal === 0 ? 0 : 50;
  const taxableAmount = Math.max(0, cartSubtotal - discountAmount);
  const tax = Number(((taxableAmount * 0.18)).toFixed(2));
  const orderTotal = Number((taxableAmount + tax + deliveryCharge).toFixed(2));

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponValidating(true);
    setCouponMessage(null);
    try {
      const result = await couponService.validateCoupon(couponCode, cartSubtotal);
      if (result.valid && result.coupon) {
        setAppliedCoupon(result.coupon);
        setDiscountAmount(result.discountAmount);
        setCouponMessage(`Coupon ${result.coupon.code} applied! Saved ₹${result.discountAmount}`);
      } else {
        setAppliedCoupon(null);
        setDiscountAmount(0);
        setCouponMessage(result.message || "Invalid coupon code");
      }
    } catch {
      setCouponMessage("Failed to validate coupon");
    } finally {
      setCouponValidating(false);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setSubmitting(true);
    try {
      const payload = {
        customerSnapshot: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          address,
          city,
          state,
          pinCode,
        },
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        paymentMethod: paymentMethod as any,
      };

      const result = await orderService.createCustomerOrder(payload);
      setOrderSuccess(result);
      setCart([]);
      setShowCheckout(false);
      loadProducts(); // Reload to show decremented stock!
    } catch (err: any) {
      alert("Checkout error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Banner & Header */}
      <div className="bg-slate-900 text-white py-2 px-4 text-center text-xs font-medium">
        <span>🚀 Customer Storefront Simulation — Orders placed here automatically flow to Admin Panel, update inventory & sales!</span>
      </div>

      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/store" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">
              E
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">E-Shop Storefront</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
            >
              <span>Back to Admin Panel</span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
            </Link>

            <button
              onClick={() => setShowCheckout(true)}
              className="relative flex items-center gap-2 rounded-lg bg-slate-900 text-white px-4 py-2 text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Cart ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
              {cart.length > 0 && (
                <span className="font-bold text-indigo-300">
                  {formatCurrency(cartSubtotal)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Store Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Success Modal / Banner */}
        {orderSuccess && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 shrink-0" />
              <div className="space-y-2 flex-1">
                <h3 className="text-xl font-bold text-emerald-950">
                  Order Successfully Placed & Processed!
                </h3>
                <p className="text-sm text-emerald-800">
                  Order Number: <span className="font-mono font-bold text-emerald-900">{orderSuccess.orderNumber}</span> • Total Paid: <span className="font-bold">{formatCurrency(orderSuccess.total)}</span>
                </p>
                <p className="text-xs text-emerald-700 leading-relaxed max-w-2xl">
                  Notice: Inventory was atomically reduced, ledger transactions were posted to Firestore, sales aggregated in salesDaily/salesMonthly, and notifications dispatched to the admin dashboard!
                </p>
                <div className="pt-3 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/invoice/${orderSuccess.orderId}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 text-white px-4 py-2 text-xs font-semibold hover:bg-emerald-800"
                  >
                    View & Print Tax Invoice
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href={`/admin/orders/${orderSuccess.orderId}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-900 px-4 py-2 text-xs font-semibold hover:bg-emerald-50"
                  >
                    View in Admin Panel
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={() => setOrderSuccess(null)}
                    className="text-xs font-medium text-emerald-800 underline ml-2 cursor-pointer"
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 sm:p-12 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-3 max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 border border-indigo-500/30">
              <Sparkles className="h-3.5 w-3.5" />
              Automated Sales Pipeline
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Test Real-World Customer Orders
            </h1>
            <p className="text-sm text-slate-300">
              Pick products, apply available coupons (e.g. <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300 font-mono">WELCOME10</code> or <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300 font-mono">FLAT500</code>), and checkout to see live Firebase order lifecycle execution.
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-white/10 p-4 border border-white/10 backdrop-blur-sm text-xs">
            <span className="font-semibold text-indigo-200">Available Promo Codes:</span>
            <span className="font-mono text-white">WELCOME10 • 10% Off orders &gt; ₹1,000</span>
            <span className="font-mono text-white">FLAT500 • Flat ₹500 Off orders &gt; ₹3,000</span>
          </div>
        </div>

        {/* Product Catalog Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Featured Products</h2>
            <span className="text-xs text-slate-500">{products.length} Products Available in Firestore</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 py-12 text-center">
              <p className="col-span-full text-slate-400 text-sm">Loading Firestore catalog...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
              <p className="text-sm text-slate-500 mb-4">No products found in Firestore catalog.</p>
              <Link href="/admin/dashboard" className="text-xs font-semibold text-indigo-600 underline">
                Go to Admin to Seed or Add Products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => {
                const inStock = product.stockQuantity > 0;
                const price = product.discountPrice && product.discountPrice > 0 ? product.discountPrice : product.sellingPrice;
                const hasDiscount = product.discountPrice && product.discountPrice > 0 && product.discountPrice < product.sellingPrice;

                return (
                  <div
                    key={product.id}
                    className="flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:shadow-md transition-shadow"
                  >
                    {/* Image */}
                    <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                      {product.images && product.images[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="h-full w-full object-cover object-center transition-transform hover:scale-105 duration-300"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400 text-xs">
                          No Image
                        </div>
                      )}
                      <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 items-end">
                        {product.stockQuantity <= (product.lowStockThreshold || 5) && inStock && (
                          <Badge variant="warning">Low Stock ({product.stockQuantity})</Badge>
                        )}
                        {!inStock && <Badge variant="danger">Out of Stock</Badge>}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex flex-1 flex-col p-4 justify-between space-y-3">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          {product.categoryName || "General"}
                        </span>
                        <h3 className="font-semibold text-sm text-slate-900 line-clamp-1 mt-0.5">
                          {product.name}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {product.shortDescription || product.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-base font-bold text-slate-900">
                            {formatCurrency(price)}
                          </span>
                          {hasDiscount && (
                            <span className="ml-1.5 text-xs text-slate-400 line-through">
                              {formatCurrency(product.sellingPrice)}
                            </span>
                          )}
                        </div>

                        <Button
                          size="sm"
                          disabled={!inStock}
                          onClick={() => addToCart(product)}
                          className={inStock ? "bg-slate-900 hover:bg-slate-800" : "opacity-50"}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Slide-over Cart / Checkout Drawer */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setShowCheckout(false)}
          />

          <div className="relative z-50 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Your Cart ({cart.length})</h3>
              </div>
              <button
                onClick={() => setShowCheckout(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
                <ShoppingBag className="h-12 w-12 text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-700">Your cart is empty</p>
                <p className="text-xs text-slate-400 mt-1">Add items from the store catalog to continue.</p>
              </div>
            ) : (
              <form onSubmit={handlePlaceOrder} className="flex-1 flex flex-col justify-between space-y-6 pt-4">
                {/* Item List */}
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {cart.map((item) => {
                    const price = item.product.discountPrice || item.product.sellingPrice;
                    return (
                      <div
                        key={item.product.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={item.product.images?.[0] || "/placeholder.png"}
                            alt=""
                            className="h-12 w-12 rounded-lg object-cover bg-slate-200"
                          />
                          <div>
                            <p className="font-semibold text-slate-900 line-clamp-1">{item.product.name}</p>
                            <p className="text-slate-500">{formatCurrency(price)} each</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="h-6 w-6 rounded border border-slate-300 flex items-center justify-center hover:bg-slate-200 cursor-pointer"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="font-semibold w-4 text-center">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="h-6 w-6 rounded border border-slate-300 flex items-center justify-center hover:bg-slate-200 cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            className="ml-2 text-rose-500 hover:text-rose-700 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Coupon Code Input */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="text-xs font-semibold text-slate-700">Promo / Coupon Code</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. WELCOME10"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleApplyCoupon}
                      loading={couponValidating}
                    >
                      Apply
                    </Button>
                  </div>
                  {couponMessage && (
                    <p
                      className={`text-xs ${
                        appliedCoupon ? "text-emerald-600 font-semibold" : "text-rose-600 font-medium"
                      }`}
                    >
                      {couponMessage}
                    </p>
                  )}
                </div>

                {/* Customer Details Form */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Shipping & Customer Info
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Full Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Input
                    label="Phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                  />
                  <Input
                    label="Shipping Address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} required />
                    <Input label="State" value={state} onChange={(e) => setState(e.target.value)} required />
                    <Input label="PIN" value={pinCode} onChange={(e) => setPinCode(e.target.value)} required />
                  </div>
                </div>

                {/* Payment Method */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { id: "card", label: "Card / Stripe" },
                      { id: "upi", label: "UPI / QR" },
                      { id: "cod", label: "Cash on Delivery" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as any)}
                        className={`p-2 rounded-lg border text-center font-medium transition-colors cursor-pointer ${
                          paymentMethod === m.id
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="space-y-1.5 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(cartSubtotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Discount ({appliedCoupon?.code})</span>
                      <span>-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>GST / Taxes (18%)</span>
                    <span>{formatCurrency(tax)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Delivery Charge</span>
                    <span>{deliveryCharge === 0 ? "FREE" : formatCurrency(deliveryCharge)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold text-sm pt-2 border-t border-slate-200">
                    <span>Total Amount</span>
                    <span>{formatCurrency(orderTotal)}</span>
                  </div>
                </div>

                <Button type="submit" loading={submitting} className="w-full h-11 text-sm bg-indigo-600 hover:bg-indigo-500">
                  Confirm & Place Order ({formatCurrency(orderTotal)})
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
