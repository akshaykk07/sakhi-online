"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { notificationService } from "@/features/notifications/notificationService";
import { Notification, NotificationType } from "@/types";
import { formatDate } from "@/lib/utils/cn";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Select";
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  ShoppingBag,
  ExternalLink,
  RotateCcw,
  CheckCheck,
} from "lucide-react";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const items = await notificationService.getNotifications(100);
      setNotifications(items);
    } catch (e) {
      console.error("Notifications load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    await notificationService.markAsRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleMarkAllAsRead = async () => {
    await notificationService.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const filtered = notifications.filter((n) => (filter === "unread" ? !n.read : true));

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case "new_order":
        return <ShoppingBag className="h-5 w-5 text-indigo-600" />;
      case "low_stock":
      case "out_of_stock":
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case "payment_failure":
      case "cancellation":
        return <AlertTriangle className="h-5 w-5 text-rose-600" />;
      case "refund_request":
        return <RotateCcw className="h-5 w-5 text-blue-600" />;
      default:
        return <Bell className="h-5 w-5 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Notification Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated event triggers for new customer orders, low inventory, and payment reconciliations
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            Mark All as Read
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
            filter === "all" ? "bg-slate-900 text-white" : "bg-white border text-slate-700"
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
            filter === "unread" ? "bg-slate-900 text-white" : "bg-white border text-slate-700"
          }`}
        >
          Unread ({notifications.filter((n) => !n.read).length})
        </button>
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading notifications...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No Notifications"
            description="You are completely caught up! New orders or inventory warnings will trigger notifications automatically."
          />
        ) : (
          filtered.map((notif) => (
            <div
              key={notif.id}
              className={`flex items-start justify-between p-4 rounded-xl border transition-all ${
                !notif.read
                  ? "bg-white border-indigo-200 shadow-xs"
                  : "bg-slate-50/70 border-slate-200/80 text-slate-600"
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    !notif.read ? "bg-indigo-50" : "bg-slate-100"
                  }`}
                >
                  {getNotificationIcon(notif.type)}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{notif.title}</h4>
                    {!notif.read && (
                      <span className="h-2 w-2 rounded-full bg-indigo-600 inline-block" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600">{notif.message}</p>
                  <span className="text-[10px] text-slate-400 block pt-1">
                    {formatDate(notif.createdAt)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-4">
                {notif.referenceId && (
                  <Link
                    href={
                      notif.referenceType === "product"
                        ? `/admin/products`
                        : `/admin/orders/${notif.referenceId}`
                    }
                  >
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                      <span>View</span>
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                )}

                {!notif.read && (
                  <button
                    onClick={() => handleMarkAsRead(notif.id)}
                    className="text-xs text-slate-400 hover:text-slate-700 font-medium px-2 py-1 cursor-pointer"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
