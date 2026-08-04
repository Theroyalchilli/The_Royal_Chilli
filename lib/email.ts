import { Resend } from "resend";

// Same pattern as lib/stripe.ts: allowed to be null until RESEND_API_KEY is
// configured, so the rest of the ordering/reservation flow never depends on
// email actually being set up. Every send is fire-and-forget from the caller
// — a failed email must never fail the order/reservation itself.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Resend's shared testing domain — works with zero DNS setup, but (per
// Resend's own restriction on unverified sending domains) can only deliver
// to the email address the Resend account itself was signed up with, not to
// arbitrary customers. Once a real domain is verified, change this to
// something like "The Royal Chilli <orders@theroyalchilli.co.uk>".
const FROM = "The Royal Chilli <onboarding@resend.dev>";

export async function sendOrderConfirmationEmail(
  to: string | null | undefined,
  data: {
    orderNumber: string;
    orderType: "takeaway" | "delivery";
    total: number;
    scheduledFor: string | null;
    items: { name: string; quantity: number }[];
  }
) {
  if (!resend || !to) return;
  try {
    const itemsHtml = data.items.map((i) => `<li>${i.quantity}x ${i.name}</li>`).join("");
    const when = data.scheduledFor
      ? `Scheduled for ${new Date(data.scheduledFor).toLocaleString("en-GB")}`
      : "As soon as possible";
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Order confirmed — ${data.orderNumber}`,
      html: `
        <h2>Thanks for your order, The Royal Chilli</h2>
        <p><strong>Order:</strong> ${data.orderNumber}</p>
        <p><strong>Type:</strong> ${data.orderType === "delivery" ? "Delivery" : "Takeaway"}</p>
        <p><strong>When:</strong> ${when}</p>
        <ul>${itemsHtml}</ul>
        <p><strong>Total: £${data.total.toFixed(2)}</strong></p>
      `,
    });
  } catch (err) {
    console.error("Order confirmation email failed:", err);
  }
}

export async function sendReservationConfirmationEmail(
  to: string | null | undefined,
  data: {
    customerName: string;
    partySize: number;
    reservationDate: string;
    reservationTime: string;
    waitlisted: boolean;
    depositAmount: number;
  }
) {
  if (!resend || !to) return;
  try {
    const statusLine = data.waitlisted
      ? "You've been added to the waitlist for this time — we'll be in touch if a table frees up."
      : "Your table is confirmed.";
    const depositLine =
      data.depositAmount > 0
        ? `<p>A deposit of £${data.depositAmount.toFixed(2)} is required to secure this booking.</p>`
        : "";
    await resend.emails.send({
      from: FROM,
      to,
      subject: data.waitlisted ? "You're on the waitlist — The Royal Chilli" : "Reservation confirmed — The Royal Chilli",
      html: `
        <h2>Hi ${data.customerName},</h2>
        <p>${statusLine}</p>
        <p><strong>Date:</strong> ${data.reservationDate}</p>
        <p><strong>Time:</strong> ${data.reservationTime}</p>
        <p><strong>Party size:</strong> ${data.partySize}</p>
        ${depositLine}
      `,
    });
  } catch (err) {
    console.error("Reservation confirmation email failed:", err);
  }
}
