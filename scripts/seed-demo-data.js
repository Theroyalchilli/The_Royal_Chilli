// Seeds 6 weeks of realistic demo data (4 weeks past + 2 weeks upcoming,
// anchored on "today") across rota, attendance, reservations and orders, so
// the Staff Hub / Attendance dashboards have something real to show instead
// of empty states.
//
// Writes directly to the one shared Supabase DB (no separate staging DB
// exists for this project). Every seeded row is clearly tagged so it can be
// found and removed later:
//   - reservations / delivery orders use fake guests named "Seed: <name>"
//   - every seeded row's id is recorded in seed-demo-data-manifest.json
//
// Usage:
//   node scripts/seed-demo-data.js            (dry run — prints counts only)
//   node scripts/seed-demo-data.js --apply     (writes to the DB)
//
// Companion: scripts/seed-demo-data-cleanup.js deletes everything recorded
// in the manifest and restores each staff row's original rota_* columns.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVar = (name) => (envContent.match(new RegExp('^' + name + '=(.+)$', 'm')) || [])[1]?.trim();
const supabase = createClient(envVar('SUPABASE_URL'), envVar('SUPABASE_SERVICE_ROLE_KEY'));

const MANIFEST_PATH = path.join(__dirname, 'seed-demo-data-manifest.json');

// ---------------------------------------------------------------------------
// Date helpers — all our dates fall inside British Summer Time (UTC+1), so a
// fixed -1h offset from London wall-clock to UTC is safe for this window.
// ---------------------------------------------------------------------------
function ymd(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
function isoWeekday(dateStr) {
  // 1=Mon .. 7=Sun
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  return day === 0 ? 7 : day;
}
function londonToUTC(dateStr, hh, mm) {
  const d = new Date(`${dateStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);
  d.setUTCHours(d.getUTCHours() - 1); // BST -> UTC
  return d.toISOString();
}
function timeStr(hh, mm) {
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
}
function pad3(n) {
  return String(n).padStart(3, '0');
}

// ---------------------------------------------------------------------------
// Randomness helpers (seeded so re-running --dry-run gives stable counts)
// ---------------------------------------------------------------------------
let seed = 42;
function rand() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}
function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function chance(p) {
  return rand() < p;
}

const today = '2026-09-12';
const pastStart = addDays(today, -28);
const pastEnd = addDays(today, -1);
const upcomingEnd = addDays(today, 13);

console.log(`Window: ${pastStart} .. ${pastEnd} (past, completed) | ${today} .. ${upcomingEnd} (upcoming, scheduled)`);

// ---------------------------------------------------------------------------
// Rota patterns for the 6 floor staff (Susie/HR and Admin excluded)
// ---------------------------------------------------------------------------
const STAFF = [
  { id: 13, name: 'Hari',    days: [2, 3, 4, 5, 6, 7], start: [12, 0], end: [22, 0], breakMin: 30 },
  { id: 14, name: 'Monika',  days: [3, 4, 5, 6, 7],    start: [17, 0], end: [23, 0], breakMin: 20 },
  { id: 15, name: 'Vijay',   days: [1, 2, 3, 4, 5],    start: [11, 0], end: [15, 0], breakMin: 15 },
  { id: 16, name: 'Suraj',   days: [4, 5, 6, 7, 1],    start: [17, 30], end: [23, 30], breakMin: 20 },
  { id: 17, name: 'Namitha', days: [2, 3, 4, 5, 6],    start: [11, 30], end: [15, 30], breakMin: 15 },
  { id: 18, name: 'Shweta',  days: [3, 4, 5, 6, 7],    start: [18, 0], end: [22, 30], breakMin: 20 },
];

// One employee gets exactly one forgotten clock-out across the whole window —
// attendance only allows one open shift per person at a time, ever.
const MISSED_CLOCKOUT_STAFF = new Set([14, 16]); // Monika, Suraj

const manifest = { staffRotaBackup: [], shiftIds: [], attendanceIds: [], reservationIds: [], orderIds: [] };

async function chunkedInsert(table, rows, chunkSize = 400) {
  const ids = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    if (!APPLY) continue;
    const { data, error } = await supabase.from(table).insert(chunk).select('id');
    if (error) throw new Error(`insert into ${table} failed: ${error.message}`);
    ids.push(...data.map((r) => r.id));
  }
  return ids;
}

async function main() {
  // -------------------------------------------------------------------
  // 1) staff.rota_* — back up current values, then set real patterns
  // -------------------------------------------------------------------
  for (const s of STAFF) {
    const { data: before } = await supabase.from('staff').select('id, rota_start, rota_end, rota_working_days, rota_break_minutes').eq('id', s.id).single();
    manifest.staffRotaBackup.push(before);
    if (APPLY) {
      const { error } = await supabase.from('staff').update({
        rota_start: timeStr(...s.start),
        rota_end: timeStr(...s.end),
        rota_working_days: s.days,
        rota_break_minutes: s.breakMin,
      }).eq('id', s.id);
      if (error) throw new Error(`staff update failed for ${s.name}: ${error.message}`);
    }
  }
  console.log(`Rota patterns set for ${STAFF.length} staff.`);

  // -------------------------------------------------------------------
  // 2) shifts (rota) + attendance (past only)
  // -------------------------------------------------------------------
  const shiftRows = []; // { staff_id, shift_date, start_time, end_time, notes?, __key }
  const missedClockoutUsed = new Set();

  for (let d = pastStart; d <= upcomingEnd; d = addDays(d, 1)) {
    const wd = isoWeekday(d);
    const isPast = d <= pastEnd;
    for (const s of STAFF) {
      if (!s.days.includes(wd)) continue;
      let status = 'scheduled';
      let notes = null;
      if (isPast) {
        if (chance(0.05)) {
          status = 'missed';
          notes = 'No-show';
        } else {
          status = 'completed';
        }
      }
      shiftRows.push({
        staff_id: s.id,
        shift_date: d,
        start_time: timeStr(...s.start),
        end_time: timeStr(...s.end),
        status,
        notes,
        __staffId: s.id,
        __date: d,
        __start: s.start,
        __end: s.end,
        __breakMin: s.breakMin,
        __isPast: isPast,
        __outcome: status,
      });
    }
  }

  const cleanShiftRows = shiftRows.map(({ __staffId, __date, __start, __end, __breakMin, __isPast, __outcome, ...rest }) => rest);
  console.log(`Shifts to create: ${shiftRows.length} (${shiftRows.filter((r) => r.__isPast).length} past, ${shiftRows.filter((r) => !r.__isPast).length} upcoming)`);

  let insertedShiftIds = [];
  if (APPLY) {
    insertedShiftIds = await chunkedInsert('shifts', cleanShiftRows);
    manifest.shiftIds = insertedShiftIds;
  }

  // Build attendance rows for 'completed' past shifts, pairing with the shift id by array position.
  const attendanceRows = [];
  shiftRows.forEach((row, idx) => {
    if (!row.__isPast || row.__outcome !== 'completed') return;
    const shiftId = APPLY ? insertedShiftIds[idx] : null;
    const [sh, sm] = row.__start;
    const [eh, em] = row.__end;
    const scheduledStart = londonToUTC(row.__date, sh, sm);
    const scheduledEnd = londonToUTC(row.__date, eh, em);

    const forgotOut = MISSED_CLOCKOUT_STAFF.has(row.__staffId) && !missedClockoutUsed.has(row.__staffId) && chance(0.15);
    if (forgotOut) missedClockoutUsed.add(row.__staffId);

    // Clock-in variance: mostly on time, sometimes a few minutes late.
    const inVarianceMin = chance(0.7) ? randInt(-2, 4) : randInt(5, 20);
    const clockIn = new Date(scheduledStart);
    clockIn.setUTCMinutes(clockIn.getUTCMinutes() + inVarianceMin);

    let clockOut = null;
    let outVarianceMin = 0;
    if (!forgotOut) {
      outVarianceMin = chance(0.8) ? randInt(-3, 8) : randInt(-15, -5);
      const co = new Date(scheduledEnd);
      co.setUTCMinutes(co.getUTCMinutes() + outVarianceMin);
      clockOut = co;
    }

    const breakSeconds = row.__breakMin * 60;
    const netWorkSeconds = clockOut ? Math.max(0, Math.floor((clockOut.getTime() - clockIn.getTime()) / 1000) - breakSeconds) : 0;
    const lateSeconds = Math.max(0, Math.floor((clockIn.getTime() - new Date(scheduledStart).getTime()) / 1000));
    const earlySeconds = clockOut ? Math.max(0, Math.floor((new Date(scheduledEnd).getTime() - clockOut.getTime()) / 1000)) : 0;

    attendanceRows.push({
      staff_id: row.__staffId,
      work_date: row.__date,
      shift_id: shiftId,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      clock_in: clockIn.toISOString(),
      clock_out: clockOut ? clockOut.toISOString() : null,
      clock_in_method: 'web',
      clock_out_method: clockOut ? 'web' : null,
      break_seconds: breakSeconds,
      net_work_seconds: netWorkSeconds,
      regular_seconds: netWorkSeconds,
      overtime_seconds: 0,
      late_seconds: lateSeconds,
      early_departure_seconds: earlySeconds,
      is_overnight: false,
      status: clockOut ? 'clocked_out' : 'clocked_in',
      approval_status: 'auto',
    });
  });

  console.log(`Attendance rows to create: ${attendanceRows.length} (${[...missedClockoutUsed].length} forgotten clock-outs)`);
  if (APPLY) {
    manifest.attendanceIds = await chunkedInsert('attendance', attendanceRows);
  }

  // -------------------------------------------------------------------
  // 3) reservations — spread across all 6 weeks
  // -------------------------------------------------------------------
  const FAKE_NAMES = ['Aarav Kumar', 'Priya Shah', 'Liam O\'Connor', 'Sofia Rossi', 'James Patel', 'Emily Clarke',
    'Noah Singh', 'Isabella Khan', 'Oliver Reddy', 'Ava Fernandes', 'Mia Sharma', 'Ethan Gupta', 'Chloe Iyer', 'Lucas Verma'];
  const { data: tables } = await supabase.from('restaurant_tables').select('id, capacity').order('id');

  const reservationRows = [];
  let guestCounter = 1;
  for (let d = pastStart; d <= upcomingEnd; d = addDays(d, 1)) {
    const wd = isoWeekday(d);
    const isWeekend = wd === 5 || wd === 6 || wd === 7;
    const count = isWeekend ? randInt(4, 7) : randInt(2, 5);
    const isPast = d < today;
    const isToday = d === today;

    for (let i = 0; i < count; i++) {
      const lunch = chance(0.4);
      const hh = lunch ? randInt(12, 14) : randInt(18, 21);
      const mm = pick([0, 15, 30, 45]);
      const partySize = chance(0.7) ? randInt(2, 4) : randInt(5, 8);
      const name = `Seed: ${pick(FAKE_NAMES)}`;
      const phone = `07000${pad3(guestCounter)}${pad3(randInt(0, 999))}`.slice(0, 11);

      let status;
      if (isPast) status = chance(0.7) ? 'seated' : chance(0.5) ? 'no_show' : 'cancelled';
      else if (isToday) status = chance(0.6) ? 'confirmed' : 'pending';
      else status = chance(0.55) ? 'confirmed' : chance(0.7) ? 'pending' : 'waitlisted';

      const table = status === 'seated' ? pick(tables.filter((t) => t.capacity >= partySize) || tables) : null;

      reservationRows.push({
        customer_name: name,
        customer_phone: phone,
        party_size: partySize,
        reservation_date: d,
        reservation_time: timeStr(hh, mm),
        table_id: table ? table.id : null,
        status,
        source: chance(0.6) ? 'website' : 'pos',
      });
      guestCounter++;
    }
  }

  console.log(`Reservations to create: ${reservationRows.length}`);
  if (APPLY) {
    manifest.reservationIds = await chunkedInsert('reservations', reservationRows);
  }

  // -------------------------------------------------------------------
  // 4) orders + order_items — past 28 days only (upcoming hasn't happened)
  // -------------------------------------------------------------------
  const { data: menuItems } = await supabase.from('menu_items').select('id, name, price').eq('active', 1).eq('pos_available', 1);

  // Existing order_numbers per day, so we continue the sequence without colliding.
  const { data: existingOrders } = await supabase.from('orders').select('order_number, created_at');
  const perDayCount = new Map();
  for (const o of existingOrders || []) {
    const day = (o.order_number.match(/^RC-(\d{8})-/) || [])[1];
    if (!day) continue;
    perDayCount.set(day, Math.max(perDayCount.get(day) || 0, parseInt(o.order_number.slice(-3), 10)));
  }

  const orderPlans = []; // holds order row + its line items, built together
  for (let d = pastStart; d <= pastEnd; d = addDays(d, 1)) {
    const wd = isoWeekday(d);
    const isWeekend = wd === 5 || wd === 6 || wd === 7;
    const count = isWeekend ? randInt(16, 24) : randInt(10, 15);
    const dayKey = d.replace(/-/g, '');
    let seq = perDayCount.get(dayKey) || 0;

    // Which staff are rota'd today, split lunch/dinner, for a plausible staff_id.
    const workingToday = STAFF.filter((s) => s.days.includes(wd));
    const lunchStaff = workingToday.filter((s) => s.start[0] < 16);
    const dinnerStaff = workingToday.filter((s) => s.start[0] >= 16);

    for (let i = 0; i < count; i++) {
      seq++;
      const isLunch = chance(0.4);
      const hh = isLunch ? randInt(12, 14) : chance(0.85) ? randInt(18, 21) : randInt(15, 17);
      const mm = randInt(0, 59);
      const orderType = chance(0.55) ? 'dine_in' : chance(0.65) ? 'takeaway' : 'delivery';
      const staffPool = (isLunch ? lunchStaff : dinnerStaff).length ? (isLunch ? lunchStaff : dinnerStaff) : STAFF;
      const staffId = pick(staffPool).id;

      const itemCount = randInt(1, 4);
      const items = [];
      for (let n = 0; n < itemCount; n++) {
        const mi = pick(menuItems);
        items.push({ menu_item_id: mi.id, item_name: mi.name, item_price: mi.price, quantity: randInt(1, 2), status: 'pending' });
      }
      const subtotal = Math.round(items.reduce((s, it) => s + it.item_price * it.quantity, 0) * 100) / 100;
      const discount = chance(0.1) ? Math.min(subtotal, randInt(1, 3)) : 0;
      const taxable = orderType === 'dine_in' || chance(0.5);
      const tax = taxable ? Math.round((subtotal - discount) * 0.2 * 100) / 100 : 0;
      const total = Math.round((subtotal - discount + tax) * 100) / 100;
      const status = chance(0.9) ? 'paid' : 'cancelled';

      const order = {
        order_number: `RC-${dayKey}-${pad3(seq)}`,
        order_type: orderType,
        table_id: orderType === 'dine_in' ? pick(tables).id : null,
        customer_name: orderType === 'dine_in' ? null : `Seed: ${pick(FAKE_NAMES)}`,
        customer_phone: orderType === 'dine_in' ? null : `07000${pad3(seq)}${pad3(randInt(0, 999))}`.slice(0, 11),
        customer_address: orderType === 'delivery' ? '12 Seed Street, Hounslow' : null,
        status,
        staff_id: staffId,
        subtotal,
        discount,
        tax,
        total,
        service_charge_pct: 0,
        service_charge_amount: 0,
        amount_paid: status === 'paid' ? total : 0,
        delivery_status: orderType === 'delivery' && status === 'paid' ? 'delivered' : null,
        created_at: londonToUTC(d, hh, mm),
      };
      orderPlans.push({ order, items });
    }
    perDayCount.set(dayKey, seq);
  }

  console.log(`Orders to create: ${orderPlans.length} (~${orderPlans.reduce((s, p) => s + p.items.length, 0)} line items)`);

  if (APPLY) {
    for (let i = 0; i < orderPlans.length; i += 200) {
      const batch = orderPlans.slice(i, i + 200);
      const { data: insertedOrders, error } = await supabase.from('orders').insert(batch.map((p) => p.order)).select('id');
      if (error) throw new Error(`insert into orders failed: ${error.message}`);
      manifest.orderIds.push(...insertedOrders.map((r) => r.id));
      const itemRows = [];
      batch.forEach((p, j) => {
        const orderId = insertedOrders[j].id;
        p.items.forEach((it) => itemRows.push({ ...it, order_id: orderId }));
      });
      const { error: itemErr } = await supabase.from('order_items').insert(itemRows);
      if (itemErr) throw new Error(`insert into order_items failed: ${itemErr.message}`);
    }
  }

  if (APPLY) {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log(`\nDone. Manifest written to ${MANIFEST_PATH}`);
  } else {
    console.log('\nDry run only — nothing written. Re-run with --apply to write to the database.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
