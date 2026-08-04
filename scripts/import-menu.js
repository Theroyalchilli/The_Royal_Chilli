// Imports the restaurant's menu spreadsheet into menu_categories/menu_items.
// Usage: node scripts/import-menu.js <path-to-xlsx>
//
// Full-replace import: clears existing menu_categories/menu_items and
// reloads from the spreadsheet. Safe as long as no live orders reference
// the current menu_item ids yet (order_items stores its own item_name/
// item_price snapshot, so past orders are unaffected either way).
//
// Expected columns: Category | Subcategory | Item | Price (£) | Notes
// A price cell like "6.95/7.95/8.95" with an Item like "Dosa (Veg/Chicken/Mutton)"
// is expanded into one menu item per slash-separated variant, matched by position.

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
function envVar(name) {
  const m = envContent.match(new RegExp('^' + name + '=(.+)$', 'm'));
  return m ? m[1].trim() : undefined;
}

const supabaseUrl = envVar('SUPABASE_URL');
const serviceRoleKey = envVar('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env.local');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceRoleKey);

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/import-menu.js <path-to-xlsx>');
  process.exit(1);
}

function isVeg(category, subcategory) {
  const s = (subcategory || '').toLowerCase();
  if (s.includes('non-veg')) return 0;
  if (s === 'veg') return 1;
  if (category.toLowerCase() === 'desserts') return 1;
  return 0; // combos / mixed / unspecified default to non-veg-safe labeling
}

// Veg-ness of one variant token, judged from the token itself (e.g. "Veg", "Chicken").
// Returns null when the token gives no signal (caller falls back to row-level isVeg).
function vegFromToken(token) {
  const t = token.toLowerCase();
  if (t.includes('non-veg')) return 0;
  if (t.includes('veg')) return 1;
  return null;
}

function expandRow(category, subcategory, item, priceCell, notes) {
  const priceStr = String(priceCell);
  if (!priceStr.includes('/')) {
    const price = Number(priceStr);
    if (isNaN(price)) return [];
    return [{ category, subcategory, name: item, price, notes, is_veg: isVeg(category, subcategory) }];
  }
  // Variant row: split both the item's variant names (from parentheses/slashes) and prices positionally.
  const prices = priceStr.split('/').map(p => Number(p.trim()));
  const variantMatch = item.match(/\(([^)]+)\)/);
  let variantNames = variantMatch
    ? variantMatch[1].split('/').map(v => v.trim())
    : item.split('/').map(v => v.trim());
  const baseName = variantMatch ? item.slice(0, variantMatch.index).trim() : '';

  if (!variantMatch) {
    // No parentheses: e.g. "Veg /Chicken / Lamb /Prawns Biryani" — only the last
    // variant spells out the trailing word ("Biryani"); propagate it to the others.
    const lastWords = variantNames[variantNames.length - 1].split(/\s+/);
    const suffix = lastWords.length > 1 ? lastWords[lastWords.length - 1] : null;
    if (suffix) {
      variantNames = variantNames.map(v =>
        v.toLowerCase().endsWith(suffix.toLowerCase()) ? v : `${v} ${suffix}`
      );
    }
  }

  return prices.map((price, i) => {
    const variant = variantNames[i] || variantNames[variantNames.length - 1];
    const veg = vegFromToken(variant);
    return {
      category,
      subcategory,
      name: baseName ? `${baseName} (${variant})` : `${category} — ${variant}`,
      price,
      notes,
      is_veg: veg !== null ? veg : isVeg(category, subcategory),
    };
  });
}

async function main() {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }).slice(1); // skip header

  const categoryOrder = [];
  const items = [];

  for (const row of rows) {
    const [category, subcategory, item, priceCell, notes] = row;
    if (!category || !item || priceCell === undefined) continue;
    if (!categoryOrder.includes(category)) categoryOrder.push(category);
    for (const expanded of expandRow(category, subcategory, item, priceCell, notes)) {
      items.push(expanded);
    }
  }

  console.log(`Parsed ${items.length} menu items across ${categoryOrder.length} categories.`);

  // Full replace: order matters due to FK from menu_items -> menu_categories.
  const { error: delItemsErr } = await supabase.from('menu_items').delete().neq('id', 0);
  if (delItemsErr) throw delItemsErr;
  const { error: delCatErr } = await supabase.from('menu_categories').delete().neq('id', 0);
  if (delCatErr) throw delCatErr;

  const categoryIds = {};
  for (let i = 0; i < categoryOrder.length; i++) {
    const name = categoryOrder[i];
    const { data, error } = await supabase
      .from('menu_categories')
      .insert({ name, display_order: i, active: 1 })
      .select('id')
      .single();
    if (error) throw error;
    categoryIds[name] = data.id;
  }

  const perCategoryOrder = {};
  const itemRows = items.map(it => {
    perCategoryOrder[it.category] = (perCategoryOrder[it.category] || 0) + 1;
    return {
      category_id: categoryIds[it.category],
      name: it.name,
      description: it.notes || null,
      price: it.price,
      is_veg: it.is_veg,
      active: 1,
      display_order: perCategoryOrder[it.category],
    };
  });

  const { error: insertErr } = await supabase.from('menu_items').insert(itemRows);
  if (insertErr) throw insertErr;

  console.log(`Imported ${categoryOrder.length} categories and ${itemRows.length} items.`);
}

main().catch(err => {
  console.error('IMPORT FAILED:', err.message || err);
  process.exit(1);
});
