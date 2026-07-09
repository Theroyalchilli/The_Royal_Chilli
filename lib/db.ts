import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "pos.db");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema();
  }
  return db;
}

function initSchema() {
  const database = db;

  database.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS menu_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      color TEXT DEFAULT '#ef4444',
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES menu_categories(id),
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      is_veg INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number TEXT NOT NULL,
      capacity INTEGER DEFAULT 4,
      status TEXT DEFAULT 'available',
      location TEXT DEFAULT 'main'
    );

    CREATE TABLE IF NOT EXISTS work_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opened_by INTEGER REFERENCES staff(id),
      closed_by INTEGER REFERENCES staff(id),
      opened_at TEXT DEFAULT (datetime('now')),
      closed_at TEXT,
      opening_cash REAL DEFAULT 0,
      closing_cash REAL,
      status TEXT DEFAULT 'open'
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      order_type TEXT NOT NULL,
      table_id INTEGER REFERENCES restaurant_tables(id),
      customer_name TEXT,
      customer_phone TEXT,
      customer_address TEXT,
      status TEXT DEFAULT 'open',
      staff_id INTEGER REFERENCES staff(id),
      work_period_id INTEGER REFERENCES work_periods(id),
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      discount_reason TEXT,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id INTEGER REFERENCES menu_items(id),
      item_name TEXT NOT NULL,
      item_price REAL NOT NULL,
      quantity INTEGER DEFAULT 1,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id),
      method TEXT NOT NULL,
      amount REAL NOT NULL,
      change_given REAL DEFAULT 0,
      reference TEXT,
      staff_id INTEGER REFERENCES staff(id),
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export function generateOrderNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const database = getDb();

  const result = database
    .prepare(
      `SELECT COUNT(*) as count FROM orders WHERE date(created_at) = date('now')`
    )
    .get() as { count: number };

  const seq = (result.count + 1).toString().padStart(3, "0");
  return `RC-${dateStr}-${seq}`;
}

export default getDb;
