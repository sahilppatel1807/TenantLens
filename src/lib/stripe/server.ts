import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!stripe) {
    stripe = new Stripe(secret, {
      apiVersion: "2026-03-25.dahlia",
      typescript: true,
    });
  }
  return stripe;
}
