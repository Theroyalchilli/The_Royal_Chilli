// Generates a printable sheet of QR codes, one per table, linking to /table/<table_number>.
// Usage: node scripts/generate-table-qrs.js [baseUrl]
// Default baseUrl is http://localhost:3000 — pass your real domain for production codes.

const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { createClient } = require('@supabase/supabase-js');

const baseUrl = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
function envVar(name) {
  const m = envContent.match(new RegExp('^' + name + '=(.+)$', 'm'));
  return m ? m[1].trim() : undefined;
}
const supabase = createClient(envVar('SUPABASE_URL'), envVar('SUPABASE_SERVICE_ROLE_KEY'));

async function main() {
  const { data: tables, error } = await supabase
    .from('restaurant_tables')
    .select('table_number, capacity, location')
    .order('table_number');
  if (error) throw error;

  const outDir = path.join(__dirname, '..', 'public', 'qr-codes');
  fs.mkdirSync(outDir, { recursive: true });

  const cards = [];
  for (const t of tables) {
    const url = `${baseUrl}/table/${t.table_number}`;
    const fileName = `${t.table_number}.png`;
    await QRCode.toFile(path.join(outDir, fileName), url, { width: 400, margin: 2 });
    cards.push({ ...t, url, fileName });
    console.log(`Table ${t.table_number} -> ${url}`);
  }

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Table QR Codes</title>
<style>
  body { font-family: sans-serif; margin: 0; padding: 20px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .card { border: 2px dashed #ccc; border-radius: 12px; padding: 20px; text-align: center; page-break-inside: avoid; }
  .card img { width: 100%; max-width: 260px; }
  .card h2 { margin: 8px 0 0; font-size: 22px; }
  .card p { margin: 4px 0 0; color: #666; font-size: 13px; }
</style></head><body>
<div class="grid">
${cards.map(c => `  <div class="card"><img src="qr-codes/${c.fileName}" alt="Table ${c.table_number} QR"><h2>Table ${c.table_number}</h2><p>${c.capacity} seats · ${c.location}</p></div>`).join('\n')}
</div>
</body></html>`;

  fs.writeFileSync(path.join(__dirname, '..', 'public', 'qr-codes.html'), html);
  console.log(`\nGenerated ${cards.length} QR codes. Open /qr-codes.html to print.`);
}

main().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
