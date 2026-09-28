"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/features/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ShieldCheck, Lock, Mail, AlertCircle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();
  const [email, setEmail] = useState("admin@eshop.com");
  const [password, setPassword] = useState("admin123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // If already authenticated
  React.useEffect(() => {
    if (user) {
      router.push("/admin/dashboard");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email.trim(), password);
      router.push("/admin/dashboard");
    } catch (err: any) {
      console.error("Login failure:", err);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Invalid email address or password.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please try again later.");
      } else {
        setError(err.message || "Failed to sign in. Please verify your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Left Column: Visual & Value Proposition */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 border-r border-slate-800 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/30">
            E
          </div>
          <span className="text-xl font-bold tracking-tight">E-Shop Admin Engine</span>
        </div>

        <div className="space-y-6 max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Autonomous Commerce Automation</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
            Automate your entire sales & order lifecycle with Firebase.
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Zero manual sales entry. When a customer orders, the system automatically validates prices, decrements stock, records immutable inventory ledger entries, updates real-time financial aggregates, and produces verified invoices.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
            <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-3">
              <span className="text-xs text-slate-400 block font-medium">Order Processing</span>
              <span className="text-base font-bold text-white mt-1 block">Atomic Transactions</span>
            </div>
            <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-3">
              <span className="text-xs text-slate-400 block font-medium">Sales Ledger</span>
              <span className="text-base font-bold text-white mt-1 block">Live Aggregations</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Enterprise Security • Firestore Distributed Database • RBAC Architecture
        </div>
      </div>

      {/* Right Column: Sign In Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8 bg-white p-8 sm:p-10 rounded-2xl shadow-2xl border border-slate-100">
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Administrator Sign In</h2>
            <p className="text-xs text-slate-500 mt-1">
              Enter your authorized business credentials to access management controls
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Admin Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@eshop.com"
              required
              autoComplete="email"
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full mt-2" loading={loading}>
              Sign In to Admin
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="text-center">
              <Link
                href="/store"
                className="text-xs font-semibold text-slate-600 hover:text-indigo-600 inline-flex items-center gap-1.5"
              >
                <span>Looking for the Customer Storefront? Go to /store</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
