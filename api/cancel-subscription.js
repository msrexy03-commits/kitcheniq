import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    // Get the subscription ID from the profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("subscription_id")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.subscription_id) {
      return res.status(400).json({ error: "No active subscription found." });
    }

    // Cancel at period end so they keep access until billing cycle ends
    await stripe.subscriptions.update(profile.subscription_id, {
      cancel_at_period_end: true,
    });

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error("Cancel subscription error:", e);
    return res.status(500).json({ error: e.message });
  }
}