"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updatePassword as firebaseUpdatePassword,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firebaseAuth, firestoreDb } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { AdminUser, AdminRole, Permission, ROLE_PERMISSIONS } from "@/types";

interface AuthContextType {
  user: User | null;
  adminProfile: AdminUser | null;
  loading: boolean;
  isConfigured: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (newPass: string) => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (roles: AdminRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    const isConfig = isFirebaseConfigured();
    setConfigured(isConfig);

    if (!firebaseAuth || !firestoreDb) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && firestoreDb) {
        try {
          const adminDocRef = doc(firestoreDb, "admins", currentUser.uid);
          const adminDocSnap = await getDoc(adminDocRef);

          if (adminDocSnap.exists()) {
            setAdminProfile(adminDocSnap.data() as AdminUser);
          } else {
            // If admin record does not exist yet (e.g. first admin or emulator user), create super_admin record
            const defaultRole: AdminRole = "super_admin";
            const newAdmin: AdminUser = {
              uid: currentUser.uid,
              email: currentUser.email || "admin@eshop.com",
              displayName: currentUser.displayName || currentUser.email?.split("@")[0] || "Administrator",
              role: defaultRole,
              permissions: ROLE_PERMISSIONS[defaultRole],
              active: true,
              lastLoginAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            };
            await setDoc(adminDocRef, newAdmin);
            setAdminProfile(newAdmin);
          }
        } catch (e) {
          console.error("Error fetching admin profile:", e);
          // Fallback permissions in case of initial rules setup
          setAdminProfile({
            uid: currentUser.uid,
            email: currentUser.email || "admin@eshop.com",
            displayName: currentUser.displayName || "Admin",
            role: "super_admin",
            permissions: ROLE_PERMISSIONS.super_admin,
            active: true,
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        setAdminProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    if (!firebaseAuth) throw new Error("Firebase Auth is not initialized. Please configure .env.local.");
    await signInWithEmailAndPassword(firebaseAuth, email, pass);
  };

  const logout = async () => {
    if (!firebaseAuth) return;
    await firebaseSignOut(firebaseAuth);
    setUser(null);
    setAdminProfile(null);
  };

  const resetPassword = async (email: string) => {
    if (!firebaseAuth) throw new Error("Firebase Auth is not initialized.");
    await sendPasswordResetEmail(firebaseAuth, email);
  };

  const changePassword = async (newPass: string) => {
    if (!firebaseAuth?.currentUser) throw new Error("No active user session.");
    await firebaseUpdatePassword(firebaseAuth.currentUser, newPass);
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!adminProfile) return false;
    if (adminProfile.role === "super_admin") return true;
    return adminProfile.permissions?.includes(permission) ?? false;
  };

  const hasRole = (roles: AdminRole[]): boolean => {
    if (!adminProfile) return false;
    if (adminProfile.role === "super_admin") return true;
    return roles.includes(adminProfile.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        adminProfile,
        loading,
        isConfigured: configured,
        login,
        logout,
        resetPassword,
        changePassword,
        hasPermission,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
