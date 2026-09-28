export interface BusinessSettings {
  businessName: string;
  logo: string;
  address: string;
  phone: string;
  email: string;
  gstNumber: string;
  currency: string;
  currencySymbol: string;
  deliveryCharge: number;
  freeDeliveryThreshold: number;
  defaultTaxRate: number; // percentage (e.g. 18 for 18% GST)
  defaultLowStockThreshold: number;
  autoConfirmOrders: boolean;
  inventoryPolicy: "reduce_on_order" | "reduce_on_payment";
  updatedAt: string;
  updatedBy?: string;
}

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  businessName: "E-Shop Commerce",
  logo: "/logo.png",
  address: "123 Tech Park, Phase II, Bengaluru, Karnataka, India",
  phone: "+91 98765 43210",
  email: "support@eshopcommerce.com",
  gstNumber: "29AAAAA0000A1Z5",
  currency: "INR",
  currencySymbol: "₹",
  deliveryCharge: 50,
  freeDeliveryThreshold: 1000,
  defaultTaxRate: 18,
  defaultLowStockThreshold: 5,
  autoConfirmOrders: true,
  inventoryPolicy: "reduce_on_order",
  updatedAt: new Date().toISOString(),
};
