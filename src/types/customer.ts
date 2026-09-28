export type CustomerStatus = "active" | "blocked" | "inactive";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  totalOrders: number;
  totalSpending: number;
  lastOrderDate?: string;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
}
