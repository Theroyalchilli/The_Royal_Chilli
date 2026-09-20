import type { Metadata } from "next";
import { siteContent } from "@/lib/site-content";
import Reveal from "@/components/site/Reveal";

export const metadata: Metadata = {
  title: "Privacy Policy — The Royal Chilli",
  description: "How The Royal Chilli collects, uses and protects your personal data.",
};

const sections: { heading: string; body: string[] }[] = [
  {
    heading: "Who we are",
    body: [
      // TODO: confirm legal trading status (sole trader / partnership / Ltd) and add
      // a company registration number here if one applies — needed for a fully
      // accurate controller statement before this goes live.
      `The Royal Chilli ("we", "us", "our") operates a restaurant, online ordering and table booking service from ${siteContent.contact.address}. This policy explains what personal data we collect through our website, app and in-restaurant systems, why we collect it, and what rights you have over it.`,
    ],
  },
  {
    heading: "What we collect",
    body: [
      "Account details: your name, email address, mobile number and a securely hashed password if you create an account.",
      "Order and booking details: items ordered, delivery or collection address, table reservation date/time/party size, and any special requests or allergy notes you add.",
      "Loyalty data: points balance and reward redemptions if you're a member of our loyalty programme.",
      "Marketing preferences: whether you've opted in to receive offers and updates by email — off by default, and you choose this explicitly.",
      "Payment information: we never see or store your full card details. Payments are processed directly by Stripe, our payment provider — see \"Payment processing\" below.",
      "Technical data: standard web server logs (IP address, browser type, pages visited) generated automatically by hosting and security infrastructure.",
    ],
  },
  {
    heading: "How we use it",
    body: [
      "To take and fulfil your orders and table reservations, and to contact you about them (e.g. order confirmations, booking reminders).",
      "To run your account, including loyalty points and order history.",
      "To send you offers, news and updates by email — only if you've opted in, and you can withdraw this consent at any time.",
      "To keep our systems secure, prevent fraud, and meet our legal and accounting obligations.",
      "We do not sell your personal data, and we do not use third-party advertising or analytics tracking on this website.",
    ],
  },
  {
    heading: "Cookies",
    body: [
      "This site uses only what's strictly necessary to work: a session cookie that keeps you logged in to your account, and a local browser setting that remembers your cookie-banner choice. We don't currently use analytics or advertising cookies.",
    ],
  },
  {
    heading: "Payment processing",
    body: [
      "Card payments, both online and at the till, are processed by Stripe, a PCI-DSS compliant payment provider. Your card details are sent directly to Stripe and never pass through or get stored on our own systems. See Stripe's own privacy policy at stripe.com/privacy for how they handle payment data.",
    ],
  },
  {
    heading: "Who we share data with",
    body: [
      "Stripe, to process payments.",
      "Our database and hosting providers (Supabase and Vercel), who store and run the systems this site and app run on, under their own data-processing agreements.",
      "We don't share your personal data with any other third party for their own marketing purposes.",
    ],
  },
  {
    heading: "How long we keep it",
    body: [
      "We keep account and order data for as long as your account is active, and for a period afterwards where we're legally required to (for example, transaction records for tax purposes are typically kept for 6 years). You can ask us to delete your account and personal data at any time — see \"Your rights\" below.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "Under UK GDPR, you have the right to access the personal data we hold about you, ask us to correct it, ask us to delete it, restrict or object to how we use it, and receive a copy in a portable format. You can also withdraw marketing consent at any time, either from your account settings or by contacting us.",
      // TODO: add ICO registration number here if/when registered.
      "To exercise any of these rights, contact us using the details below. If you're not satisfied with how we've handled your data, you have the right to complain to the Information Commissioner's Office (ico.org.uk).",
    ],
  },
  {
    heading: "Children",
    body: ["Our services are intended for adults. We don't knowingly collect personal data from children."],
  },
  {
    heading: "Changes to this policy",
    body: ["We may update this policy from time to time. The current version will always be available on this page."],
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

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Reveal>
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Legal</p>
        <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-4xl">Privacy Policy</h1>
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
