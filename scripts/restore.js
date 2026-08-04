// Restores a backup produced by scripts/backup.js. DESTRUCTIVE: replaces the
// contents of every table it has a JSON file for. Intended for disaster
// recovery onto a fresh database (after running supabase/schema.sql there) or
// for restoring a demo/staging environment — not for casual use against a
// live production database.
//
// Usage: node scripts/restore.js <backup-folder> --force
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const TABLES = [
  "staff", "customers", "menu_categories", "menu_items", "restaurant_tables",
  "work_periods", "delivery_zones", "orders", "order_items", "payments",
  "reservations", "table_requests", "shifts", "clock_events", "breaks",
  "leave_requests", "payroll_periods", "payroll_entries", "payroll_payments",
  "audit_logs", "app_settings", "role_permissions", "staff_availability",
  "suppliers", "ingredients", "purchase_orders", "purchase_order_items",
  "stock_movements", "recipes", "recipe_ingredients", "loyalty_transactions",
  "loyalty_rewards", "expenses", "supplier_payments", "modifier_groups",
  "modifier_options", "menu_item_modifier_groups", "order_item_modifiers",
];

async function main() {
  const backupDir = process.argv[2];
  const force = process.argv.includes("--force");

  if (!backupDir || !fs.existsSync(backupDir)) {
    console.error("Usage: node scripts/restore.js <backup-folder> --force");
    process.exit(1);
  }
  if (!force) {
    console.error(
      "This will DELETE and REPLACE every row in every table listed below, in the target database.\n" +
      "Re-run with --force once you're certain that's what you want, and that DATABASE_URL points at the right database."
    );
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query("BEGIN");

    // Delete children before parents, insert parents before children.
    for (const table of [...TABLES].reverse()) {
      await client.query(`DELETE FROM ${table}`);
    }

    for (const table of TABLES) {
      const file = path.join(backupDir, `${table}.json`);
      if (!fs.existsSync(file)) {
        console.log(`  ${table}: no backup file, skipping`);
        continue;
      }
      const rows = JSON.parse(fs.readFileSync(file, "utf8"));
      if (rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const colList = columns.map((c) => `"${c}"`).join(", ");
      for (const row of rows) {
        const values = columns.map((c) => row[c]);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
        await client.query(`INSERT INTO ${table} (${colList}) VALUES (${placeholders})`, values);
      }
      console.log(`  ${table}: restored ${rows.length} rows`);

      // Restored rows carry their original explicit ids, so the table's
      // auto-increment sequence needs bumping past the highest one restored
      // or the next app-side insert would collide with a restored row.
      if (columns.includes("id")) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`,
          [table]
        );
      }
    }

    await client.query("COMMIT");
    console.log("\nRestore complete.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Restore failed, rolled back:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
