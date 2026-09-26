import { getOrderForPrint } from "@/lib/kot";
import { getOrderForReceipt } from "@/lib/receipt";
import { zReportLines } from "@/lib/z-report";
import { getZReport } from "@/lib/z-report-db";

// Renders print_jobs rows (lib/print-queue.ts) into what the Star mC-Print3
// prints. A ticket is built once as styled lines, then encoded either as
// StarPRNT commands (bold, double size, auto-cut — what the printer is
// offered first) or as plain text (the fallback every CloudPRNT printer
// supports).

export type TicketLine = {
  text: string;
  align?: "left" | "center";
  bold?: boolean;
  // "tall" = double height (still 48 columns); "big" = double width + height (24 columns)
  size?: "normal" | "tall" | "big";
};
export type Ticket = TicketLine[];

export type PrintJob = {
  id: number;
  order_id: number | null;
  work_period_id: number | null;
  kind: "kot" | "receipt" | "zreport";
  source: "till" | "qr" | "online" | null;
  item_ids: number[] | null;
};

// 80mm paper, Font A: 48 characters per line at normal width.
export const LINE_WIDTH = 48;

// Vercel runs in UTC — tickets must show restaurant-local time.
function londonTime(iso: string, withDate = false): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(withDate ? { day: "2-digit", month: "2-digit", year: "numeric" } : {}),
  }).format(new Date(iso));
}

function money(n: number): string {
  return `£${Number(n).toFixed(2)}`;
}

// Left text + right-aligned amount on one line, `width` columns wide.
function rowAt(width: number, left: string, right: string): string {
  const room = width - right.length - 1;
  const l = left.length > room ? left.slice(0, room) : left;
  return l + " ".repeat(Math.max(1, width - l.length - right.length)) + right;
}

// Each builder lays out for a given line width: the printer's own 48, or
// fewer (bigger text) for the browser-print fallback.
function layout(width: number) {
  return { row: (left: string, right: string) => rowAt(width, left, right), DIVIDER: "-".repeat(width) };
}

const SOURCE_LABEL: Record<string, string> = { till: "TILL", qr: "QR ORDER", online: "ONLINE" };

export async function buildTicket(job: PrintJob, width = LINE_WIDTH): Promise<Ticket | null> {
  if (job.kind === "zreport") return job.work_period_id ? buildZReportTicket(job.work_period_id, width) : null;
  if (!job.order_id) return null;
  return job.kind === "receipt" ? buildReceipt(job.order_id, width) : buildKitchenTicket(job, job.order_id, width);
}

async function buildZReportTicket(workPeriodId: number, width: number): Promise<Ticket | null> {
  const { row, DIVIDER } = layout(width);
  const report = await getZReport(workPeriodId);
  if (!report) return null;
  const t: Ticket = [];
  t.push({ text: "THE ROYAL CHILLI", align: "center", bold: true, size: "tall" });
  t.push({ text: DIVIDER });
  for (const l of zReportLines(report)) {
    if (l.kind === "title") t.push({ text: l.text, bold: true, size: "tall" });
    else if (l.kind === "heading") t.push({ text: l.text, bold: true });
    else if (l.kind === "row") t.push({ text: row(l.label, l.value), bold: l.bold });
    else if (l.kind === "text") t.push({ text: l.text });
    else if (l.kind === "divider") t.push({ text: DIVIDER });
    else t.push({ text: "" });
  }
  t.push({ text: DIVIDER });
  t.push({ text: `Printed ${londonTime(new Date().toISOString(), true)}`, align: "center" });
  return t;
}

async function buildKitchenTicket(job: PrintJob, orderId: number, width: number): Promise<Ticket | null> {
  const { row, DIVIDER } = layout(width);
  const data = await getOrderForPrint(orderId);
  // A cancelled order (e.g. a scheduled one cancelled before its print time)
  // must not reach the kitchen.
  if (!data || data.order.status === "cancelled") return null;
  const { order } = data;

  const items = job.item_ids ? data.items.filter((i) => job.item_ids!.includes(i.id)) : data.items;
  if (items.length === 0) return null;
  const isAddOn = job.item_ids !== null && data.items.length > items.length;

  const t: Ticket = [];
  t.push({ text: `*** ${job.source ? SOURCE_LABEL[job.source] : "REPRINT"} ***`, align: "center", bold: true, size: "big" });
  if (order.order_type === "dine_in") {
    t.push({ text: order.table_number ? `TABLE ${order.table_number}` : "DINE-IN", align: "center", bold: true, size: "big" });
  } else {
    t.push({ text: order.order_type === "delivery" ? "DELIVERY" : "COLLECTION", align: "center", bold: true, size: "big" });
  }
  if (isAddOn) t.push({ text: "+ ADDITIONAL ITEMS +", align: "center", bold: true, size: "tall" });
  if (order.scheduled_for) {
    t.push({ text: `FOR ${londonTime(order.scheduled_for)}`, align: "center", bold: true, size: "big" });
    t.push({ text: londonTime(order.scheduled_for, true), align: "center" });
  }
  t.push({ text: row(`Order ${order.order_number}`, londonTime(order.created_at, true)) });
  if (order.customer_name) t.push({ text: `Customer: ${order.customer_name}` });
  if (order.order_type !== "dine_in" && order.customer_phone) t.push({ text: `Phone: ${order.customer_phone}` });
  if (order.order_type === "delivery" && order.customer_address) {
    t.push({ text: `Address: ${order.customer_address}${order.customer_postcode ? `, ${order.customer_postcode}` : ""}` });
  }
  t.push({ text: DIVIDER });

  for (const item of items) {
    t.push({ text: `${item.quantity}x ${item.item_name}`, bold: true, size: "tall" });
    if (item.modifiers.length > 0) t.push({ text: `   - ${item.modifiers.join(", ")}` });
    if (item.notes) t.push({ text: `   *** ${item.notes.toUpperCase()} ***`, bold: true });
  }
  t.push({ text: DIVIDER });

  if (order.notes) {
    t.push({ text: `NOTE: ${order.notes}`, bold: true });
    t.push({ text: DIVIDER });
  }

  if (job.source === "online") {
    const due = Number(order.total) - Number(order.amount_paid);
    t.push(
      due <= 0.01
        ? { text: "PAID ONLINE", align: "center", bold: true, size: "tall" }
        : { text: `TO PAY: ${money(due)}`, align: "center", bold: true, size: "tall" }
    );
  }
  t.push({ text: `Printed ${londonTime(new Date().toISOString())}`, align: "center" });
  return t;
}

const METHOD_LABEL: Record<string, string> = { cash: "Cash", card: "Card", card_online: "Online" };

async function buildReceipt(orderId: number, width: number): Promise<Ticket | null> {
  const { row, DIVIDER } = layout(width);
  const data = await getOrderForReceipt(orderId);
  if (!data) return null;
  const { order, items, payments } = data;

  const balanceDue = Math.round((Number(order.total) - Number(order.amount_paid)) * 100) / 100;
  const isPaid = order.status === "paid";
  const place = order.order_type === "dine_in"
    ? (order.table_number ? `TABLE ${order.table_number}` : "DINE-IN")
    : String(order.order_type).toUpperCase();

  const t: Ticket = [];
  t.push({ text: "THE ROYAL CHILLI", align: "center", bold: true, size: "big" });
  t.push({ text: "43 Kingsley Road, Hounslow TW3 1PA", align: "center" });
  t.push({ text: "020 8797 3044", align: "center" });
  t.push({ text: DIVIDER });
  t.push({ text: "RECEIPT", align: "center", bold: true });
  t.push({ text: isPaid ? "PAID" : balanceDue > 0.01 ? "BALANCE DUE" : "UNPAID", align: "center", bold: true });
  t.push({ text: DIVIDER });
  t.push({ text: place, bold: true, size: "tall" });
  t.push({ text: row(`Order ${order.order_number}`, londonTime(order.created_at, true)) });
  if (order.staff_name) t.push({ text: `Served by: ${order.staff_name}` });
  if (order.customer_name) t.push({ text: `Customer: ${order.customer_name}` });
  t.push({ text: DIVIDER });

  for (const item of items) {
    t.push({ text: row(`${item.quantity}x ${item.item_name}`, money(Number(item.item_price) * item.quantity)) });
    for (const m of item.modifiers) {
      t.push({ text: m.price_delta !== 0 ? row(`   - ${m.option_name}`, `${m.price_delta > 0 ? "+" : ""}${money(m.price_delta)}`) : `   - ${m.option_name}` });
    }
    if (item.notes) t.push({ text: `   ** ${item.notes}` });
  }
  t.push({ text: DIVIDER });

  t.push({ text: row("Subtotal", money(order.subtotal)) });
  if (Number(order.discount) > 0) {
    t.push({ text: row(`Discount${order.discount_reason ? ` (${order.discount_reason})` : ""}`, `-${money(order.discount)}`) });
  }
  if (Number(order.service_charge_amount) > 0) t.push({ text: row("Service Charge", money(order.service_charge_amount)) });
  t.push({ text: row("TOTAL", money(order.total)), bold: true, size: "tall" });
  t.push({ text: row("incl. VAT", money(order.tax)) });
  t.push({ text: DIVIDER });

  if (payments.length > 0) {
    t.push({ text: "PAYMENTS", bold: true });
    for (const p of payments) {
      const label = `${Number(p.amount) < 0 ? "Refund - " : ""}${METHOD_LABEL[p.method] ?? p.method}${p.tip_amount > 0 ? ` (+${money(p.tip_amount)} tip)` : ""}`;
      t.push({ text: row(label, money(p.amount)) });
    }
  }
  if (balanceDue > 0.01) t.push({ text: row("Balance Due", money(balanceDue)), bold: true });
  t.push({ text: DIVIDER });
  t.push({ text: "Thank you for dining with us.", align: "center" });
  t.push({ text: `Printed ${londonTime(new Date().toISOString(), true)}`, align: "center" });
  return t;
}

// ---------- encoders ----------

export function toPlainText(ticket: Ticket): string {
  const lines = ticket.map((l) => {
    const width = l.size === "big" ? LINE_WIDTH / 2 : LINE_WIDTH;
    if (l.align !== "center" || l.text.length >= width) return l.text;
    return " ".repeat(Math.floor((LINE_WIDTH - l.text.length) / 2)) + l.text;
  });
  return [...lines, "", "", ""].join("\n");
}

// The printer only has single-byte code pages, so text goes out as CP437:
// "£" has its own byte there; accents are stripped and anything else
// non-ASCII (smart quotes, dashes, emoji from a customer's note) is swapped
// for a plain equivalent rather than printing as garbage.
const CP437_EXTRA: Record<string, number> = { "£": 0x9c };
const ASCII_SWAPS: Record<string, string> = { "—": "-", "–": "-", "‘": "'", "’": "'", "“": '"', "”": '"', "…": "...", "✓": "*" };

export function encodeCp437(text: string): number[] {
  const out: number[] = [];
  for (const ch of text.normalize("NFD").replace(/[̀-ͯ]/g, "")) {
    if (CP437_EXTRA[ch] !== undefined) out.push(CP437_EXTRA[ch]);
    else if (ASCII_SWAPS[ch]) out.push(...[...ASCII_SWAPS[ch]].map((c) => c.charCodeAt(0)));
    else {
      const code = ch.charCodeAt(0);
      out.push(code >= 0x20 && code < 0x7f ? code : 0x3f); // "?"
    }
  }
  return out;
}

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// StarPRNT command set (the mC-Print3's native emulation).
export function toStarPrnt(ticket: Ticket): Uint8Array {
  const out: number[] = [
    ESC, 0x40, // initialise
    ESC, GS, 0x74, 1, // code page 437
  ];
  for (const l of ticket) {
    out.push(ESC, GS, 0x61, l.align === "center" ? 1 : 0);
    if (l.bold) out.push(ESC, 0x45);
    if (l.size === "big") out.push(ESC, 0x69, 1, 1);
    else if (l.size === "tall") out.push(ESC, 0x69, 1, 0);
    out.push(...encodeCp437(l.text), LF);
    if (l.size === "big" || l.size === "tall") out.push(ESC, 0x69, 0, 0);
    if (l.bold) out.push(ESC, 0x46);
  }
  out.push(ESC, GS, 0x61, 0);
  out.push(ESC, 0x64, 3); // feed to cutter + partial cut
  return Uint8Array.from(out);
}
