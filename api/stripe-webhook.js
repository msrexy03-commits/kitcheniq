import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
 
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
 
export const config = { api: { bodyParser: false } };
 
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
 
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
 
  const rawBody = await getRawBody(req);
  const sig = req.headers["stripe-signature"];
 
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error("Webhook signature error:", e.message);
    return res.status(400).json({ error: `Webhook error: ${e.message}` });
  }
 
const TRACKER_PRICE_ID = "price_1TFT25BgJhkzALVkj60iZ33B";

const setSubscribed = async (userId, value, stripeCustomerId, subscriptionId, priceId) => {
    const tier = !value ? "none" : priceId === TRACKER_PRICE_ID ? "tracker" : "full";
    await supabase.from("profiles").upsert({
      id: userId,
      is_subscribed: value,
      stripe_customer_id: stripeCustomerId || null,
      subscription_id: subscriptionId || null,
      subscription_tier: tier,
    });
  };
 
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      if (userId) {
        // Get price ID from the subscription
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        const priceId = sub.items.data[0]?.price?.id;
        await setSubscribed(userId, true, session.customer, session.subscription, priceId);
      }
      break;
    }
    case "customer.subscription.deleted":
    case "customer.subscription.paused": {
      const sub = event.data.object;
      const userId = sub.metadata?.userId;
      if (userId) await setSubscribed(userId, false, sub.customer, sub.id, null);
      break;
    }
    case "customer.subscription.resumed":
    case "invoice.payment_succeeded": {
      const obj = event.data.object;
      const subId = obj.subscription || obj.id;
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId);
        const userId = sub.metadata?.userId;
        const priceId = sub.items.data[0]?.price?.id;
        if (userId) await setSubscribed(userId, true, sub.customer, sub.id, priceId);
      }
      break;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object;
      const subId = inv.subscription;
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId);
        const userId = sub.metadata?.userId;
        if (userId) await setSubscribed(userId, false, sub.customer, sub.id, null);
      }
      break;
    }
  }
 
  return res.status(200).json({ received: true });
}