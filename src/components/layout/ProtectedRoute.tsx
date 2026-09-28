"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { Permission, AdminRole } from "@/types";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: Permission;
  roles?: AdminRole[];
}

export function ProtectedRoute({ children, permission, roles }: ProtectedRouteProps) {
  const router = useRouter();
  const { user, adminProfile, loading, isConfigured, hasPermission, hasRole } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!isConfigured) {
        router.push("/setup");
      } else if (!user) {
        router.push("/login");
      }
    }
  }, [user, loading, isConfigured, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-xs font-medium text-slate-500">Verifying administrator authorization...</p>
        </div>
      </div>
    );
  }

  if (!isConfigured) {
    return null;
  }

  if (!user) {
    return null;
  }

  // Permission verification
  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Access Restricted</h3>
        <p className="mt-1 text-sm text-slate-500 max-w-md">
          Your account role (<span className="font-semibold text-slate-700 capitalize">{adminProfile?.role || "user"}</span>) does not have the required permission: <code className="text-xs bg-slate-100 px-1 py-0.5 rounded text-rose-700">{permission}</code>.
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            Go Back
          </Button>
          <Button size="sm" onClick={() => router.push("/admin/dashboard")}>
            Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Role verification
  if (roles && roles.length > 0 && !hasRole(roles)) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Insufficient Role Privileges</h3>
        <p className="mt-1 text-sm text-slate-500 max-w-md">
          This section requires one of the following roles: {roles.join(", ")}.
        </p>
        <div className="mt-6">
          <Button size="sm" onClick={() => router.push("/admin/dashboard")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
