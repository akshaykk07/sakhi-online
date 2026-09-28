"use client";

import React, { useState } from "react";
import Link from "next/link";
import { getFirebaseConfigStatus } from "@/lib/firebase/config";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CheckCircle, AlertTriangle, Terminal, ArrowRight, RefreshCw, Sparkles } from "lucide-react";

export default function SetupPage() {
  const [status, setStatus] = useState(getFirebaseConfigStatus());
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);

  const handleRefresh = () => {
    setStatus(getFirebaseConfigStatus());
  };

  const handleSeedDatabase = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      setSeedResult(data.message || "Seeding complete!");
    } catch (err: any) {
      setSeedResult("Error seeding database: " + err.message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 sm:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold">
              E
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Firebase Backend Configuration</h1>
              <p className="text-xs text-slate-400">Environment validation & production readiness diagnostic</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Check Environment
          </Button>
        </div>

        {/* Configuration Status Banner */}
        <div
          className={`rounded-2xl border p-6 ${
            status.isConfigured
              ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
              : "border-amber-500/30 bg-amber-950/20 text-amber-200"
          }`}
        >
          <div className="flex items-start gap-4">
            {status.isConfigured ? (
              <CheckCircle className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">
                {status.isConfigured ? "Firebase Backend Connected" : "Firebase Environment Keys Missing"}
              </h3>
              <p className="text-xs opacity-90 leading-relaxed">
                {status.isConfigured
                  ? `Active project target: ${status.projectId}. Client authentication, Cloud Firestore, and Storage endpoints are connected.`
                  : "Please supply your Firebase credentials in .env.local to access production Firestore collections."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Environment Variables List */}
          <Card className="bg-slate-950 border-slate-800 text-slate-200">
            <CardHeader>
              <CardTitle className="text-white text-base">Client Environment Keys</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Values expected in <code className="text-indigo-400 font-mono">.env.local</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 font-mono text-xs">
              {[
                "NEXT_PUBLIC_FIREBASE_API_KEY",
                "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
                "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
                "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
                "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
                "NEXT_PUBLIC_FIREBASE_APP_ID",
              ].map((key) => {
                const isMissing = status.missingKeys.includes(key);
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800"
                  >
                    <span className="truncate">{key}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                        isMissing
                          ? "bg-rose-900/50 text-rose-300 border border-rose-800"
                          : "bg-emerald-900/50 text-emerald-300 border border-emerald-800"
                      }`}
                    >
                      {isMissing ? "Missing" : "Set"}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Quick Emulator / Database Initialization */}
          <Card className="bg-slate-950 border-slate-800 text-slate-200">
            <CardHeader>
              <CardTitle className="text-white text-base">Quick Initialization</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Seed Firestore with standard product catalog and business settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                When deploying to a new Firebase project, run this one-click seed command to populate products, categories, coupons, and settings directly into Firestore.
              </p>

              <Button
                onClick={handleSeedDatabase}
                loading={seeding}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Initialize Firestore Catalog
              </Button>

              {seedResult && (
                <div className="rounded-lg bg-slate-900 border border-indigo-900 p-3 text-xs text-indigo-300">
                  {seedResult}
                </div>
              )}

              <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                <Link href="/login" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                  <span>Go to Admin Login</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Link href="/store" className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1">
                  <span>Open Storefront</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
