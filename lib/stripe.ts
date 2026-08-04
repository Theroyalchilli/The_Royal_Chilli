import Stripe from "stripe";

// Deliberately allowed to be null: online payment isn't required for the
// rest of the app to function, and STRIPE_SECRET_KEY won't be set until the
// restaurant actually signs up for Stripe. Every call site must check this
// and fail gracefully (hide the "pay online" option) rather than crash.
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://royal-chilli-pos.vercel.app";
}
