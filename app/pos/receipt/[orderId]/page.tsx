import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getOrderForReceipt } from "@/lib/receipt";
import AutoPrint from "./AutoPrint";
import PrintNav from "./PrintNav";

const money = (n: number) => `£${Number(n).toFixed(2)}`;
const methodLabel: Record<string, string> = { cash: "Cash", card: "Card", card_online: "Online" };

export default async function ReceiptPrintPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const data = await getOrderForReceipt(Number((await params).orderId));
  if (!data) {
    return <div style={{ padding: 20, fontFamily: "monospace" }}>Order not found.</div>;
  }
  const { order, items, payments } = data;

  const placeLabel = order.order_type === "dine_in"
    ? (order.table_number ? `TABLE ${order.table_number}` : "DINE-IN")
    : order.order_type.toUpperCase();
  const balanceDue = Math.round((Number(order.total) - Number(order.amount_paid)) * 100) / 100;
  const isPaid = order.status === "paid";

  return (
    <>
      <AutoPrint />
      <PrintNav />
      <div className="receipt-ticket">
        <p className="center bold big">THE ROYAL CHILLI</p>
        <p className="center small">43 Kingsley Road, Hounslow TW3 1PA</p>
        <p className="center small">020 8797 3044</p>
        <div className="divider" />
        <p className="center bold">RECEIPT</p>
        <p className={`center bold ${isPaid ? "paid" : "due"}`}>{isPaid ? "✓ PAID" : balanceDue > 0.01 ? "BALANCE DUE" : "UNPAID"}</p>
        <div className="divider" />

        <p className="bold big">{placeLabel}</p>
        <p>Order: {order.order_number}</p>
        <p>{new Date(order.created_at).toLocaleString("en-GB")}</p>
        {order.staff_name && <p>Served by: {order.staff_name}</p>}
        {order.customer_name && <p>Customer: {order.customer_name}</p>}
        {order.customer_phone && <p>Phone: {order.customer_phone}</p>}
        <div className="divider" />

        {items.map((item) => (
          <div key={item.id} className="item">
            <div className="row">
              <span className="bold">{item.quantity}x {item.item_name}</span>
              <span className="bold">{money(Number(item.item_price) * item.quantity)}</span>
            </div>
            {item.modifiers.map((m, i) => (
              <div key={i} className="row indent">
                <span>- {m.option_name}</span>
                {m.price_delta !== 0 && <span>{m.price_delta > 0 ? "+" : ""}{money(m.price_delta)}</span>}
              </div>
            ))}
            {item.notes && <p className="indent">** {item.notes}</p>}
          </div>
        ))}
        <div className="divider" />

        <div className="row"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
        {Number(order.discount) > 0 && (
          <div className="row">
            <span>Discount{order.discount_reason ? ` (${order.discount_reason})` : ""}</span>
            <span>-{money(order.discount)}</span>
          </div>
        )}
        {Number(order.service_charge_amount) > 0 && (
          <div className="row"><span>Service Charge</span><span>{money(order.service_charge_amount)}</span></div>
        )}
        <div className="divider" />
        <div className="row bold big"><span>TOTAL</span><span>{money(order.total)}</span></div>
        <p className="small right">incl. VAT {money(order.tax)}</p>
        <div className="divider" />

        <p className="bold">PAYMENTS</p>
        {payments.length === 0 ? (
          <p className="small">No payments recorded yet.</p>
        ) : (
          payments.map((p, i) => (
            <div key={i} className="row">
              <span>
                {Number(p.amount) < 0 ? "Refund — " : ""}{methodLabel[p.method] ?? p.method}
                {p.tip_amount > 0 ? ` (+${money(p.tip_amount)} tip)` : ""}
                <span className="small block">{new Date(p.created_at).toLocaleString("en-GB")}</span>
                {p.reference && <span className="small block">{p.reference}</span>}
              </span>
              <span className="bold">{money(p.amount)}</span>
            </div>
          ))
        )}
        {balanceDue > 0.01 && (
          <div className="row bold due"><span>Balance Due</span><span>{money(balanceDue)}</span></div>
        )}
        <div className="divider" />

        <p className="center">Thank you for dining with us.</p>
        <p className="center small">Printed {new Date().toLocaleString("en-GB")}</p>
      </div>

      <style>{`
        body { background: #fff; }
        .receipt-ticket {
          width: 80mm;
          margin: 0 auto;
          padding: 8px;
          font-family: 'Courier New', monospace;
          color: #000;
          font-size: 13px;
          line-height: 1.4;
        }
        .receipt-ticket p { margin: 2px 0; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: 700; }
        .big { font-size: 16px; }
        .small { font-size: 11px; }
        .block { display: block; }
        .indent { padding-left: 12px; font-size: 12px; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .item { margin-bottom: 4px; }
        .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin: 2px 0; }
        .paid { color: #1a7a3c; }
        .due { color: #b34700; }
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body { margin: 0; }
          .no-print { display: none; }
        }
      `}</style>
    </>
  );
}
