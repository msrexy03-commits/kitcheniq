import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { priceId, userId, userEmail, couponCode } = req.body;
  if (!priceId || !userId || !userEmail) return res.status(400).json({ error: "Missing fields" });

  try {
    const sessionParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: userEmail,
      success_url: `https://trykitcheniq.com?success=true`,
      cancel_url: `https://trykitcheniq.com?canceled=true`,
      metadata: { userId },
      subscription_data: { metadata: { userId }, trial_period_days: 7 },
    };

    if (couponCode) {
      const coupons = await stripe.coupons.list({ limit: 100 });
      const coupon = coupons.data.find(c => c.id === couponCode || c.name === couponCode);
      if (coupon) sessionParams.discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error("Stripe error:", e);
    return res.status(500).json({ error: e.message });
  }
}