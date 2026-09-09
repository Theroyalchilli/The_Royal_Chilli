import Stripe from "stripe";

// Deliberately allowed to be null: online payment isn't required for the
// rest of the app to function, and STRIPE_SECRET_KEY won't be set until the
// restaurant actually signs up for Stripe. Every call site must check this
// and fail gracefully (hide the "pay online" option) rather than crash.
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const stripeConfigured = !!stripe;

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://royal-chilli-pos.vercel.app";
}

// Single fixed premises — used when registering a Stripe Terminal reader,
// which Stripe requires to belong to a "Location" with a postal address.
// Source of truth is lib/site-content.ts (siteContent.contact.address:
// "43 Kingsley Road, Hounslow, London, TW3 1PA").
export const TERMINAL_LOCATION_ADDRESS = {
  line1: "43 Kingsley Road",
  city: "Hounslow",
  state: "London",
  postal_code: "TW3 1PA",
  country: "GB",
} as const;
