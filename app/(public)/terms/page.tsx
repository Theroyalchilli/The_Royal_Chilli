import type { Metadata } from "next";
import { siteContent } from "@/lib/site-content";
import Reveal from "@/components/site/Reveal";

export const metadata: Metadata = {
  title: "Terms & Conditions — The Royal Chilli",
  description: "The terms that apply when you order, book or use The Royal Chilli's website and services.",
};

const sections: { heading: string; body: string[] }[] = [
  {
    heading: "About these terms",
    body: [
      `These terms apply whenever you order food, book a table, or otherwise use the website or app operated by The Royal Chilli at ${siteContent.contact.address}. By placing an order or making a booking, you agree to them.`,
    ],
  },
  {
    heading: "Orders and payment",
    body: [
      "Prices shown are in GBP and include VAT where applicable. We try to keep menu prices and availability accurate, but occasionally an item may be unavailable or a price may need correcting — we'll let you know before taking payment if that happens.",
      "Online payments are processed securely by Stripe. An order is only confirmed, and sent to the kitchen, once payment has been successfully taken.",
    ],
  },
  {
    heading: "Allergens and dietary information",
    body: [
      "Our kitchen handles a wide range of ingredients, including the 14 major allergens. While we aim to provide accurate allergen information for our menu, we can't guarantee any dish is completely free of trace allergens due to shared kitchen equipment. If you have a food allergy or intolerance, please tell a member of staff before ordering.",
    ],
  },
  {
    heading: "Delivery and collection",
    body: [
      "Estimated delivery and collection times shown at checkout are estimates, not guarantees, and can be affected by demand, weather or traffic. Once an order has been handed to a delivery courier, responsibility for its handling passes to the courier.",
    ],
  },
  {
    heading: "Cancellations and refunds",
    body: [
      "If you need to cancel or change an order, contact us as soon as possible — once food preparation has started we may not be able to cancel or refund it. If we're unable to fulfil your order for any reason, we'll offer a full refund.",
    ],
  },
  {
    heading: "Table reservations",
    body: [
      "Bookings can be made online or by phone. If your plans change, please let us know as early as you can so we can offer the table to another guest — we may not be able to hold a table indefinitely past its booked time if we haven't heard from you.",
    ],
  },
  {
    heading: "Loyalty programme",
    body: [
      "Loyalty points have no cash value, are non-transferable, and can be redeemed for rewards as described in your account. We may amend or end the loyalty programme at any time; any points already earned will still be honoured for a reasonable period after any such change is announced.",
    ],
  },
  {
    heading: "Accounts",
    body: [
      "You're responsible for keeping your account password secure and for any activity under your account. Let us know immediately if you think your account has been accessed without your permission.",
    ],
  },
  {
    heading: "Website use",
    body: [
      "The content on this website — including our branding, photos and menu descriptions — belongs to The Royal Chilli and may not be copied or reused without our permission.",
    ],
  },
  {
    heading: "Liability",
    body: [
      "Nothing in these terms limits our liability for anything that can't legally be limited, such as death or personal injury caused by our negligence. Beyond that, our liability to you is limited to the value of the order or booking in question.",
    ],
  },
  {
    heading: "Governing law",
    body: ["These terms are governed by the law of England and Wales."],
  },
  {
    heading: "Changes to these terms",
    body: ["We may update these terms from time to time. The current version will always be available on this page."],
  },
  {
    heading: "Contact us",
    body: [
      `Email: Info@theroyalchilli.com`,
      `Phone: ${siteContent.contact.phone}`,
      `Post: ${siteContent.contact.address}`,
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Reveal>
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Legal</p>
        <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-4xl">Terms &amp; Conditions</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 20 September 2026</p>
      </Reveal>

      <div className="mt-10 space-y-8">
        {sections.map((s, i) => (
          <Reveal key={s.heading} delay={i * 30}>
            <h2 className="font-[family-name:var(--font-playfair)] text-xl">{s.heading}</h2>
            <div className="mt-3 space-y-2">
              {s.body.map((p, j) => (
                <p key={j} className="text-sm leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
