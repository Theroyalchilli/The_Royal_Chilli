// Syncs per-channel menu pricing from the two source spreadsheets:
//
//   online  ->  RC_online_order.xlsx        -> menu_items.online_price  (+ online_available)
//   offline ->  "Dinner menu  Inside.xlsx"  -> menu_items.price         (+ pos_available)
//
// Matches spreadsheet rows to EXISTING menu_items by name (never creates or
// deletes rows). A dish's channel availability is decided purely by which
// sheet(s) it appears in:
//   in both sheets     -> pos_available = 1, online_available = 1
//   offline sheet only -> pos_available = 1, online_available = 0
//   online sheet only  -> pos_available = 0, online_available = 1
//   neither sheet       -> active = 0 (dropped from both menus)
//
// Run `node scripts/import-menu-prices.js` for a dry-run report; add
// `--apply` to write. Optional custom paths:
//   node scripts/import-menu-prices.js --online <path> --offline <path> --apply
//
// Re-runnable: run it again whenever either spreadsheet changes.

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const HOME = process.env.USERPROFILE || process.env.HOME || '';
const DEFAULT_ONLINE = path.join(HOME, 'Downloads', 'RC_online_order.xlsx');
const DEFAULT_OFFLINE = path.join(HOME, 'Downloads', 'Dinner menu  Inside.xlsx');

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const APPLY = process.argv.includes('--apply');
const ONLINE_PATH = arg('--online', DEFAULT_ONLINE);
const OFFLINE_PATH = arg('--offline', DEFAULT_OFFLINE);

// --- env ---------------------------------------------------------------
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVar = (name) => (envContent.match(new RegExp('^' + name + '=(.+)$', 'm')) || [])[1]?.trim();
const supabase = createClient(envVar('SUPABASE_URL'), envVar('SUPABASE_SERVICE_ROLE_KEY'));

// --- name matching ----------------------------------------------------
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\(.*?\)/g, ' ')      // drop parenthetical notes, e.g. "(Brinjal)"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Spreadsheet spelling -> the spelling used in menu_items. Only needed where
// the two disagree; everything else matches on normalised name directly.
const ALIASES = {
  'veg sweet corn soup': 'vegetarian sweet corn soup',
  'veg lemon coriander soup': 'vegetarian lemon coriander soup',
  'veg hot and sour soup': 'vegetarian hot and sour soup',
  'veg manchow soup': 'vegetarian manchow soup',
  'lasooni chili chicken fry': 'lasooni chilli chicken fry',
  'tandori roti': 'tandoori roti',
};
const canon = (name) => {
  const n = norm(name);
  return ALIASES[n] || n;
};

const money = (v) => {
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

// --- load a sheet ----------------------------------------------------
// Both sheets share columns {Category, "Dish / Item Name", Price, Active}
// but in different column orders — resolve by header name.
function loadSheet(file) {
  const wb = xlsx.readFile(file);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const header = rows[0].map((h) => String(h || '').trim().toLowerCase());
  const col = (want) => header.findIndex((h) => h === want);
  const iName = col('dish / item name') !== -1 ? col('dish / item name') : col('item name');
  const iPrice = col('price') !== -1 ? col('price') : col('pricing');
  const iActive = col('active');

  const out = new Map();
  for (const r of rows.slice(1)) {
    const name = r[iName];
    const price = money(r[iPrice]);
    if (!name || price == null) continue;
    if (iActive !== -1 && r[iActive] && String(r[iActive]).trim().toLowerCase() !== 'yes') continue;
    out.set(canon(name), { name: String(name).trim(), price });
  }
  return out;
}

async function main() {
  for (const [label, p] of [['online', ONLINE_PATH], ['offline', OFFLINE_PATH]]) {
    if (!fs.existsSync(p)) {
      console.error(`${label} sheet not found: ${p}`);
      process.exit(1);
    }
  }

  const online = loadSheet(ONLINE_PATH);
  const offline = loadSheet(OFFLINE_PATH);
  console.log(`online sheet:  ${online.size} items  (${ONLINE_PATH})`);
  console.log(`offline sheet: ${offline.size} items  (${OFFLINE_PATH})\n`);

  // select * so a dry run works before migration 028 adds the new columns;
  // missing columns just read back as undefined and fall to defaults below.
  const { data: rawItems, error } = await supabase
    .from('menu_items')
    .select('*, menu_categories(name)')
    .order('id');
  if (error) throw error;
  const items = rawItems.map((i) => ({
    ...i,
    online_price: i.online_price ?? null,
    pos_available: i.pos_available ?? 1,
    online_available: i.online_available ?? 1,
  }));

  const dbByCanon = new Map(items.map((i) => [canon(i.name), i]));

  const updates = [];       // { item, price, online_price, pos_available, online_available }
  const deactivate = [];    // db items in neither sheet (and currently active)
  const matchedCanons = new Set();

  for (const item of items) {
    const key = canon(item.name);
    const on = online.get(key);
    const off = offline.get(key);
    if (on) matchedCanons.add(`online:${key}`);
    if (off) matchedCanons.add(`offline:${key}`);

    if (!on && !off) {
      if (item.active) deactivate.push(item);
      continue;
    }
    const next = {
      price: off ? off.price : Number(item.price),
      online_price: on ? on.price : (off ? off.price : Number(item.price)),
      pos_available: off ? 1 : 0,
      online_available: on ? 1 : 0,
      active: 1,
    };
    const changed =
      Number(item.price) !== next.price ||
      Number(item.online_price ?? NaN) !== next.online_price ||
      (item.pos_available ?? 1) !== next.pos_available ||
      (item.online_available ?? 1) !== next.online_available ||
      item.active !== 1;
    if (changed) updates.push({ item, next });
  }

  const unmatchedOnline = [...online].filter(([k]) => !dbByCanon.has(k));
  const unmatchedOffline = [...offline].filter(([k]) => !dbByCanon.has(k));

  // --- report --------------------------------------------------------
  const fmt = (n) => (n == null ? '  —  ' : '£' + Number(n).toFixed(2).padStart(6));
  console.log(`=== PRICE / AVAILABILITY CHANGES (${updates.length}) ===`);
  for (const { item, next } of updates) {
    const flags = `pos:${next.pos_available} web:${next.online_available}`;
    console.log(
      `  ${String(item.id).padStart(4)}  ${item.name.padEnd(38)}` +
      `  dine ${fmt(item.price)}->${fmt(next.price)}   web ${fmt(item.online_price)}->${fmt(next.online_price)}   ${flags}` +
      (item.active !== 1 ? '  [REACTIVATE]' : '')
    );
  }

  console.log(`\n=== IN A SHEET BUT NO DATABASE MATCH — needs a manual add/alias ===`);
  if (!unmatchedOnline.length && !unmatchedOffline.length) console.log('  (none)');
  for (const [k, v] of unmatchedOnline) console.log(`  online   "${v.name}"  £${v.price}   [canon: ${k}]`);
  for (const [k, v] of unmatchedOffline) console.log(`  offline  "${v.name}"  £${v.price}   [canon: ${k}]`);

  console.log(`\n=== ACTIVE IN DB BUT IN NEITHER SHEET — will be set active = 0 (${deactivate.length}) ===`);
  for (const i of deactivate) console.log(`  ${String(i.id).padStart(4)}  [${i.menu_categories?.name}]  ${i.name}`);

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to write these changes.');
    return;
  }

  console.log('\nApplying…');
  for (const { item, next } of updates) {
    const { error: e } = await supabase
      .from('menu_items')
      .update({
        price: next.price,
        online_price: next.online_price,
        pos_available: next.pos_available,
        online_available: next.online_available,
        active: 1,
      })
      .eq('id', item.id);
    if (e) throw e;
  }
  for (const i of deactivate) {
    const { error: e } = await supabase.from('menu_items').update({ active: 0 }).eq('id', i.id);
    if (e) throw e;
  }
  console.log(`Done. ${updates.length} items updated, ${deactivate.length} deactivated.`);
}

main().catch((err) => {
  console.error('FAILED:', err.message || err);
  process.exit(1);
});
