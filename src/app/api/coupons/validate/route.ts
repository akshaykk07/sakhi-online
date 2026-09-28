import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { validateAndCalculateCoupon } from "@/lib/business-rules";
import { Coupon } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { code, subtotal, customerId } = await req.json();

    if (!code) {
      return NextResponse.json({ valid: false, message: "Coupon code is required" }, { status: 400 });
    }

    const cleanCode = code.toUpperCase().trim();
    const db = getAdminDb();

    const snapshot = await db.collection("coupons").where("code", "==", cleanCode).where("active", "==", true).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json({ valid: false, message: "Invalid or inactive coupon code." }, { status: 404 });
    }

    const doc = snapshot.docs[0];
    const coupon = { id: doc.id, ...doc.data() } as Coupon;

    // Check usage by customer if customerId given
    let customerUsageCount = 0;
    if (customerId) {
      const customerOrders = await db
        .collection("orders")
        .where("customerId", "==", customerId)
        .where("couponId", "==", coupon.id)
        .get();
      customerUsageCount = customerOrders.size;
    }

    const result = validateAndCalculateCoupon(coupon, Number(subtotal || 0), customerUsageCount);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Coupon validation API error:", error);
    return NextResponse.json({ valid: false, message: "Failed to validate coupon." }, { status: 500 });
  }
}
