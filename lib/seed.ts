import bcrypt from "bcryptjs";
import getDb from "./db";

export async function seedDatabase() {
  const db = getDb();

  // Check if already seeded
  const staffCount = db
    .prepare("SELECT COUNT(*) as count FROM staff")
    .get() as { count: number };
  if (staffCount.count > 0) {
    return { message: "Database already seeded", skipped: true };
  }

  // Seed Staff
  const staffData = [
    { name: "Suresh", pin: "1234", role: "owner" },
    { name: "Manager", pin: "2345", role: "manager" },
    { name: "Cashier", pin: "3456", role: "cashier" },
    { name: "Kitchen", pin: "4567", role: "kitchen" },
  ];

  const insertStaff = db.prepare(
    "INSERT INTO staff (name, pin_hash, role) VALUES (?, ?, ?)"
  );

  for (const s of staffData) {
    const hash = bcrypt.hashSync(s.pin, 10);
    insertStaff.run(s.name, hash, s.role);
  }

  // Seed Menu Categories
  const categories = [
    { name: "Veg Starters", color: "#22c55e", order: 1 },
    { name: "Non-Veg Starters", color: "#ef4444", order: 2 },
    { name: "Veg Mains", color: "#16a34a", order: 3 },
    { name: "Non-Veg Mains", color: "#dc2626", order: 4 },
    { name: "Biryanis", color: "#f97316", order: 5 },
    { name: "Breads", color: "#eab308", order: 6 },
    { name: "Rice & Sides", color: "#ca8a04", order: 7 },
    { name: "Soups", color: "#3b82f6", order: 8 },
    { name: "Desserts", color: "#a855f7", order: 9 },
    { name: "Drinks", color: "#06b6d4", order: 10 },
  ];

  const insertCat = db.prepare(
    "INSERT INTO menu_categories (name, color, display_order) VALUES (?, ?, ?)"
  );

  for (const c of categories) {
    insertCat.run(c.name, c.color, c.order);
  }

  // Get category IDs
  const cats = db
    .prepare("SELECT id, name FROM menu_categories ORDER BY display_order")
    .all() as { id: number; name: string }[];
  const catMap: Record<string, number> = {};
  for (const c of cats) catMap[c.name] = c.id;

  // Seed Menu Items
  const items: {
    cat: string;
    name: string;
    price: number;
    is_veg: number;
    order: number;
  }[] = [
    // Veg Starters
    { cat: "Veg Starters", name: "Vegetable Samosa", price: 4.5, is_veg: 1, order: 1 },
    { cat: "Veg Starters", name: "Paneer Tikka", price: 7.95, is_veg: 1, order: 2 },
    { cat: "Veg Starters", name: "Chilli Paneer", price: 7.95, is_veg: 1, order: 3 },
    { cat: "Veg Starters", name: "Veg Spring Roll", price: 5.5, is_veg: 1, order: 4 },
    { cat: "Veg Starters", name: "Dahi Puri", price: 5.95, is_veg: 1, order: 5 },
    { cat: "Veg Starters", name: "Onion Bhaji", price: 4.95, is_veg: 1, order: 6 },
    // Non-Veg Starters
    { cat: "Non-Veg Starters", name: "Chicken 65", price: 8.5, is_veg: 0, order: 1 },
    { cat: "Non-Veg Starters", name: "Chicken Tikka", price: 8.95, is_veg: 0, order: 2 },
    { cat: "Non-Veg Starters", name: "Lamb Seekh Kebab", price: 9.5, is_veg: 0, order: 3 },
    { cat: "Non-Veg Starters", name: "Prawn Puri", price: 9.95, is_veg: 0, order: 4 },
    { cat: "Non-Veg Starters", name: "Fish Pakora", price: 8.95, is_veg: 0, order: 5 },
    // Veg Mains
    { cat: "Veg Mains", name: "Dal Makhani", price: 9.95, is_veg: 1, order: 1 },
    { cat: "Veg Mains", name: "Palak Paneer", price: 10.95, is_veg: 1, order: 2 },
    { cat: "Veg Mains", name: "Paneer Butter Masala", price: 11.5, is_veg: 1, order: 3 },
    { cat: "Veg Mains", name: "Chana Masala", price: 9.5, is_veg: 1, order: 4 },
    { cat: "Veg Mains", name: "Mix Veg Curry", price: 9.95, is_veg: 1, order: 5 },
    { cat: "Veg Mains", name: "Mushroom Masala", price: 9.95, is_veg: 1, order: 6 },
    // Non-Veg Mains
    { cat: "Non-Veg Mains", name: "Butter Chicken", price: 12.95, is_veg: 0, order: 1 },
    { cat: "Non-Veg Mains", name: "Chicken Tikka Masala", price: 12.95, is_veg: 0, order: 2 },
    { cat: "Non-Veg Mains", name: "Lamb Rogan Josh", price: 13.95, is_veg: 0, order: 3 },
    { cat: "Non-Veg Mains", name: "Lamb Balti", price: 13.5, is_veg: 0, order: 4 },
    { cat: "Non-Veg Mains", name: "Prawn Masala", price: 14.5, is_veg: 0, order: 5 },
    { cat: "Non-Veg Mains", name: "Chicken Madras", price: 12.5, is_veg: 0, order: 6 },
    { cat: "Non-Veg Mains", name: "King Prawn Curry", price: 15.95, is_veg: 0, order: 7 },
    // Biryanis
    { cat: "Biryanis", name: "Chicken Dum Biryani", price: 13.95, is_veg: 0, order: 1 },
    { cat: "Biryanis", name: "Lamb Dum Biryani", price: 14.95, is_veg: 0, order: 2 },
    { cat: "Biryanis", name: "Veg Biryani", price: 11.95, is_veg: 1, order: 3 },
    { cat: "Biryanis", name: "Prawn Biryani", price: 15.95, is_veg: 0, order: 4 },
    // Breads
    { cat: "Breads", name: "Plain Naan", price: 2.5, is_veg: 1, order: 1 },
    { cat: "Breads", name: "Garlic Naan", price: 3.0, is_veg: 1, order: 2 },
    { cat: "Breads", name: "Peshwari Naan", price: 3.5, is_veg: 1, order: 3 },
    { cat: "Breads", name: "Paratha", price: 2.95, is_veg: 1, order: 4 },
    { cat: "Breads", name: "Roti", price: 2.0, is_veg: 1, order: 5 },
    { cat: "Breads", name: "Puri", price: 2.5, is_veg: 1, order: 6 },
    // Rice & Sides
    { cat: "Rice & Sides", name: "Steamed Rice", price: 3.0, is_veg: 1, order: 1 },
    { cat: "Rice & Sides", name: "Pilau Rice", price: 3.5, is_veg: 1, order: 2 },
    { cat: "Rice & Sides", name: "Raita", price: 2.5, is_veg: 1, order: 3 },
    { cat: "Rice & Sides", name: "Papadum", price: 1.0, is_veg: 1, order: 4 },
    { cat: "Rice & Sides", name: "Mango Chutney", price: 1.0, is_veg: 1, order: 5 },
    { cat: "Rice & Sides", name: "Mixed Pickle", price: 1.0, is_veg: 1, order: 6 },
    // Soups
    { cat: "Soups", name: "Tomato Shorba", price: 4.95, is_veg: 1, order: 1 },
    { cat: "Soups", name: "Mulligatawny", price: 5.5, is_veg: 0, order: 2 },
    { cat: "Soups", name: "Sweet Corn Soup", price: 4.95, is_veg: 1, order: 3 },
    // Desserts
    { cat: "Desserts", name: "Gulab Jamun", price: 4.5, is_veg: 1, order: 1 },
    { cat: "Desserts", name: "Kulfi", price: 4.95, is_veg: 1, order: 2 },
    { cat: "Desserts", name: "Rasmalai", price: 5.5, is_veg: 1, order: 3 },
    { cat: "Desserts", name: "Ice Cream", price: 3.95, is_veg: 1, order: 4 },
    // Drinks
    { cat: "Drinks", name: "Mango Lassi", price: 4.0, is_veg: 1, order: 1 },
    { cat: "Drinks", name: "Sweet Lassi", price: 3.5, is_veg: 1, order: 2 },
    { cat: "Drinks", name: "Salted Lassi", price: 3.5, is_veg: 1, order: 3 },
    { cat: "Drinks", name: "Masala Chai", price: 2.5, is_veg: 1, order: 4 },
    { cat: "Drinks", name: "Soft Drink", price: 2.0, is_veg: 1, order: 5 },
    { cat: "Drinks", name: "Water", price: 1.5, is_veg: 1, order: 6 },
  ];

  const insertItem = db.prepare(
    "INSERT INTO menu_items (category_id, name, price, is_veg, display_order) VALUES (?, ?, ?, ?, ?)"
  );

  for (const item of items) {
    const catId = catMap[item.cat];
    if (catId) {
      insertItem.run(catId, item.name, item.price, item.is_veg, item.order);
    }
  }

  // Seed Tables
  const tables = [
    { number: "T1", capacity: 2, location: "main" },
    { number: "T2", capacity: 4, location: "main" },
    { number: "T3", capacity: 4, location: "main" },
    { number: "T4", capacity: 6, location: "main" },
    { number: "T5", capacity: 4, location: "main" },
    { number: "T6", capacity: 4, location: "main" },
    { number: "T7", capacity: 8, location: "main" },
    { number: "T8", capacity: 2, location: "outdoor" },
    { number: "T9", capacity: 4, location: "outdoor" },
    { number: "T10", capacity: 6, location: "private" },
  ];

  const insertTable = db.prepare(
    "INSERT INTO restaurant_tables (table_number, capacity, location) VALUES (?, ?, ?)"
  );

  for (const t of tables) {
    insertTable.run(t.number, t.capacity, t.location);
  }

  // Create an open work period
  const firstStaff = db
    .prepare("SELECT id FROM staff WHERE role = 'owner' LIMIT 1")
    .get() as { id: number };
  if (firstStaff) {
    db.prepare(
      "INSERT INTO work_periods (opened_by, opening_cash, status) VALUES (?, ?, 'open')"
    ).run(firstStaff.id, 100.0);
  }

  return { message: "Database seeded successfully", skipped: false };
}
