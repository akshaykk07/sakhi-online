import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "INR", symbol: string = "₹"): string {
  if (isNaN(amount) || amount === null || amount === undefined) return `${symbol}0.00`;
  return `${symbol}${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(date: string | number | Date | null | undefined): string {
  if (!date) return "-";
  try {
    const d = typeof date === "object" && "toDate" in (date as any) ? (date as any).toDate() : new Date(date);
    return new Intl.DateTimeFormat("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return String(date);
  }
}

export function formatDateOnly(date: string | number | Date | null | undefined): string {
  if (!date) return "-";
  try {
    const d = typeof date === "object" && "toDate" in (date as any) ? (date as any).toDate() : new Date(date);
    return new Intl.DateTimeFormat("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return String(date);
  }
}
