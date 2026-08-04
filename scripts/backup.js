// Logical backup of the Postgres database: dumps every application table's
// rows to JSON (one file per table) plus a copy of the current schema.sql,
// into a timestamped folder. Restorable with scripts/restore.js.
//
// Why JSON-per-table instead of pg_dump: pg_dump requires the Postgres client
// tools to be installed on whatever machine runs this, which isn't guaranteed
// (e.g. a Vercel cron function, a bare Windows machine). This only needs the
// `pg` npm package, which is already a project dependency, so it runs anywhere
// Node runs. See docs/BACKUP.md for the full backup strategy (this script is
// the "portable, owner-controlled" layer, not the only line of defense).
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

// Same order tables are CREATEd in supabase/schema.sql — parents before
// children, so a restore can INSERT in this order without FK violations.
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
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is not set. Add it to .env.local or export it before running this script.");
    process.exit(1);
  }

  const outDir = process.argv[2] || path.join(__dirname, "..", "backups", new Date().toISOString().replace(/[:.]/g, "-"));
  fs.mkdirSync(outDir, { recursive: true });

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const manifest = { createdAt: new Date().toISOString(), tables: {} };

  try {
    for (const table of TABLES) {
      const { rows } = await client.query(`SELECT * FROM ${table}`);
      fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 2));
      manifest.tables[table] = rows.length;
      console.log(`  ${table}: ${rows.length} rows`);
    }
  } finally {
    await client.end();
  }

  const schemaSrc = path.join(__dirname, "..", "supabase", "schema.sql");
  if (fs.existsSync(schemaSrc)) {
    fs.copyFileSync(schemaSrc, path.join(outDir, "schema.sql"));
  }

  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  const totalRows = Object.values(manifest.tables).reduce((a, b) => a + b, 0);
  console.log(`\nBackup complete: ${outDir}`);
  console.log(`${TABLES.length} tables, ${totalRows} total rows.`);
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
