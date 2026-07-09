export interface Staff {
  id: number;
  name: string;
  pin_hash: string;
  role: "owner" | "manager" | "cashier" | "kitchen";
  active: number;
  created_at: string;
}

export interface MenuCategory {
  id: number;
  name: string;
  display_order: number;
  color: string;
  active: number;
}

export interface MenuItem {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  price: number;
  is_veg: number;
  active: number;
  display_order: number;
  category_name?: string;
  category_color?: string;
}

export interface RestaurantTable {
  id: number;
  table_number: string;
  capacity: number;
  status: "available" | "occupied" | "reserved";
  location: "main" | "outdoor" | "private";
}

export interface WorkPeriod {
  id: number;
  opened_by: number;
  closed_by: number | null;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  status: "open" | "closed";
}

export interface Order {
  id: number;
  order_number: string;
  order_type: "dine_in" | "takeaway" | "delivery";
  table_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  status: "open" | "sent_to_kitchen" | "ready" | "paid" | "cancelled";
  staff_id: number;
  work_period_id: number | null;
  subtotal: number;
  discount: number;
  discount_reason: string | null;
  tax: number;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  table_number?: string;
  staff_name?: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  menu_item_id: number | null;
  item_name: string;
  item_price: number;
  quantity: number;
  notes: string | null;
  status: "pending" | "preparing" | "ready";
  created_at: string;
}

export interface Payment {
  id: number;
  order_id: number;
  method: "cash" | "card";
  amount: number;
  change_given: number;
  reference: string | null;
  staff_id: number;
  created_at: string;
}

export interface SessionUser {
  id: number;
  name: string;
  role: "owner" | "manager" | "cashier" | "kitchen";
}

export interface CartItem {
  menu_item_id: number;
  item_name: string;
  item_price: number;
  quantity: number;
  notes?: string;
  is_veg?: number;
}

export interface CategoryWithItems extends MenuCategory {
  items: MenuItem[];
}
