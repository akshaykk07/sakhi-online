import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { DEFAULT_BUSINESS_SETTINGS } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const db = getAdminDb();
    const nowIso = new Date().toISOString();

    // Check if categories already exist
    const catCheck = await db.collection("categories").limit(1).get();
    if (!catCheck.empty) {
      // Force query parameter can allow re-seeding
      const { searchParams } = new URL(req.url);
      if (searchParams.get("force") !== "true") {
        return NextResponse.json({
          message: "Database already contains catalog records. Pass ?force=true to append.",
        });
      }
    }

    const batch = db.batch();

    // 1. Business Settings
    const settingsRef = db.collection("settings").doc("business");
    batch.set(settingsRef, {
      ...DEFAULT_BUSINESS_SETTINGS,
      updatedAt: nowIso,
    });

    // 2. Categories
    const categories = [
      {
        id: "cat_electronics",
        name: "Electronics & Gadgets",
        slug: "electronics-gadgets",
        description: "Premium headphones, smart accessories, and devices",
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80",
        active: true,
        productCount: 3,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "cat_apparel",
        name: "Apparel & Fashion",
        slug: "apparel-fashion",
        description: "Quality clothing, sneakers, and modern wear",
        image: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&auto=format&fit=crop&q=80",
        active: true,
        productCount: 2,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "cat_accessories",
        name: "Watches & Accessories",
        slug: "watches-accessories",
        description: "Minimalist timepieces, leather goods, and bags",
        image: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80",
        active: true,
        productCount: 2,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "cat_home",
        name: "Home & Workspace",
        slug: "home-workspace",
        description: "Ergonomic desk accessories and modern decor",
        image: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600&auto=format&fit=crop&q=80",
        active: true,
        productCount: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    for (const cat of categories) {
      batch.set(db.collection("categories").doc(cat.id), cat);
    }

    // 3. Products
    const products = [
      {
        id: "prod_anc_headphones",
        name: "Aura Pro Wireless Noise-Cancelling Headphones",
        slug: "aura-pro-wireless-headphones",
        sku: "AUD-HD-001",
        description: "Premium studio sound with active hybrid noise cancellation, 40-hour battery life, memory foam earcups, and dual beamforming microphones.",
        shortDescription: "Studio-grade wireless ANC headphones",
        categoryId: "cat_electronics",
        categoryName: "Electronics & Gadgets",
        brand: "AuraSound",
        costPrice: 4200,
        sellingPrice: 7999,
        discountPrice: 6999,
        stockQuantity: 28,
        lowStockThreshold: 5,
        status: "active",
        featured: true,
        images: [
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&auto=format&fit=crop&q=80",
        ],
        variants: [
          { id: "var_black", name: "Midnight Black", sku: "AUD-HD-001-BLK", price: 6999, stockQuantity: 18, attributes: { Color: "Midnight Black" } },
          { id: "var_silver", name: "Platinum Silver", sku: "AUD-HD-001-SLV", price: 6999, stockQuantity: 10, attributes: { Color: "Platinum Silver" } },
        ],
        attributes: [{ name: "Color", values: ["Midnight Black", "Platinum Silver"] }],
        weight: 280,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "prod_smart_watch",
        name: "Chronos Apex Smartwatch v2",
        slug: "chronos-apex-smartwatch-v2",
        sku: "WCH-APX-002",
        description: "Titanium chassis with sapphire crystal AMOLED display, heart rate, SpO2, GPS tracking, and 7-day battery life.",
        shortDescription: "Titanium GPS smartwatch with AMOLED display",
        categoryId: "cat_accessories",
        categoryName: "Watches & Accessories",
        brand: "Chronos",
        costPrice: 8500,
        sellingPrice: 14999,
        discountPrice: 12999,
        stockQuantity: 14,
        lowStockThreshold: 4,
        status: "active",
        featured: true,
        images: [
          "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
        ],
        variants: [],
        attributes: [{ name: "Strap", values: ["Silicone", "Leather"] }],
        weight: 52,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "prod_leather_backpack",
        name: "Voyager Full-Grain Leather Backpack",
        slug: "voyager-full-grain-leather-backpack",
        sku: "BAG-LEA-003",
        description: "Handcrafted from vegetable-tanned full-grain leather. Features padded 16-inch laptop compartment, brass hardware, and waterproof lining.",
        shortDescription: "Handcrafted full-grain leather laptop backpack",
        categoryId: "cat_accessories",
        categoryName: "Watches & Accessories",
        brand: "Voyager & Co",
        costPrice: 3200,
        sellingPrice: 5999,
        discountPrice: 5499,
        stockQuantity: 9,
        lowStockThreshold: 3,
        status: "active",
        featured: false,
        images: [
          "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80",
        ],
        variants: [],
        attributes: [],
        weight: 950,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "prod_merino_hoodie",
        name: "Merino Thermal Minimalist Hoodie",
        slug: "merino-thermal-minimalist-hoodie",
        sku: "APP-HD-004",
        description: "100% fine Merino wool hoodie. Naturally temperature regulating, odor resistant, and exceptionally soft against the skin.",
        shortDescription: "Ultra-soft 100% Merino wool thermal hoodie",
        categoryId: "cat_apparel",
        categoryName: "Apparel & Fashion",
        brand: "Nordic Atelier",
        costPrice: 1800,
        sellingPrice: 3499,
        discountPrice: 2999,
        stockQuantity: 22,
        lowStockThreshold: 5,
        status: "active",
        featured: true,
        images: [
          "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80",
        ],
        variants: [
          { id: "var_m", name: "Size M / Charcoal", sku: "APP-HD-004-M", price: 2999, stockQuantity: 12, attributes: { Size: "M", Color: "Charcoal" } },
          { id: "var_l", name: "Size L / Charcoal", sku: "APP-HD-004-L", price: 2999, stockQuantity: 10, attributes: { Size: "L", Color: "Charcoal" } },
        ],
        attributes: [
          { name: "Size", values: ["M", "L", "XL"] },
          { name: "Color", values: ["Charcoal", "Navy"] },
        ],
        weight: 420,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "prod_mechanical_keyboard",
        name: "Lumina Wireless Mechanical Keyboard",
        slug: "lumina-wireless-mechanical-keyboard",
        sku: "ELC-KB-005",
        description: "75% compact layout with hot-swappable switches, CNC aluminum frame, PBT double-shot keycaps, and tri-mode connectivity (2.4G, Bluetooth, USB-C).",
        shortDescription: "75% CNC aluminum wireless mechanical keyboard",
        categoryId: "cat_electronics",
        categoryName: "Electronics & Gadgets",
        brand: "Lumina Keyboards",
        costPrice: 4500,
        sellingPrice: 8499,
        discountPrice: 7999,
        stockQuantity: 3, // Low stock on purpose to test low stock alerts!
        lowStockThreshold: 5,
        status: "active",
        featured: true,
        images: [
          "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80",
        ],
        variants: [],
        attributes: [{ name: "Switch", values: ["Linear Silent", "Tactile Pro"] }],
        weight: 880,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    for (const prod of products) {
      batch.set(db.collection("products").doc(prod.id), prod);

      // Initial Stock In transaction
      const txRef = db.collection("inventoryTransactions").doc(`init_${prod.id}`);
      batch.set(txRef, {
        id: txRef.id,
        productId: prod.id,
        productName: prod.name,
        type: "stock_in",
        quantity: prod.stockQuantity,
        previousStock: 0,
        newStock: prod.stockQuantity,
        reason: "Initial catalog inventory stocking",
        referenceId: "CATALOG_INIT",
        performedBy: "system",
        performedByName: "System Setup",
        createdAt: nowIso,
      });
    }

    // 4. Coupons
    const coupons = [
      {
        id: "coupon_welcome10",
        code: "WELCOME10",
        type: "percentage",
        value: 10,
        minimumOrderAmount: 1000,
        maximumDiscount: 1000,
        startDate: "2026-01-01T00:00:00.000Z",
        expiryDate: "2027-12-31T23:59:59.000Z",
        usageLimit: 1000,
        usedCount: 0,
        perCustomerLimit: 1,
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "coupon_flat500",
        code: "FLAT500",
        type: "fixed",
        value: 500,
        minimumOrderAmount: 3000,
        startDate: "2026-01-01T00:00:00.000Z",
        expiryDate: "2027-12-31T23:59:59.000Z",
        usageLimit: 500,
        usedCount: 0,
        perCustomerLimit: 2,
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    for (const coupon of coupons) {
      batch.set(db.collection("coupons").doc(coupon.id), coupon);
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: "Firestore catalog initialized successfully with products, categories, coupons, and settings.",
      seeded: {
        categories: categories.length,
        products: products.length,
        coupons: coupons.length,
      },
    });
  } catch (error: any) {
    console.error("Seed API error:", error);
    return NextResponse.json({ error: error?.message || "Failed to seed database." }, { status: 500 });
  }
}
