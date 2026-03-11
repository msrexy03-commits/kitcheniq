import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap";
document.head.appendChild(fontLink);

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const today = () => new Date().toISOString().split("T")[0];
const fmt$ = (n) => `$${Number(n).toFixed(4)}`;
const fmt$2 = (n) => `$${Number(n).toFixed(2)}`;
const fmtPct = (n) => `${Number(n).toFixed(1)}%`;

// ─── Unit cost calculator ─────────────────────────────────────────────────────
// Converts between units for cost calculation
const UNIT_CONVERSIONS = {
  // weight
  lb: { oz: 16, lb: 1, g: 453.592 },
  oz: { oz: 1, lb: 0.0625, g: 28.3495 },
  g: { g: 1, oz: 0.03527, lb: 0.002205 },
  // count
  each: { each: 1 },
  pack: { pack: 1 },
  case: { case: 1 },
  bag: { bag: 1 },
};

function convertUnits(value, fromUnit, toUnit) {
  const from = fromUnit?.toLowerCase();
  const to = toUnit?.toLowerCase();
  if (from === to) return value;
  if (UNIT_CONVERSIONS[from] && UNIT_CONVERSIONS[from][to] !== undefined) {
    return value * UNIT_CONVERSIONS[from][to];
  }
  return value; // can't convert, return as-is
}

// Calculate cost per base unit from ingredient
function getUnitCost(ingredient) {
  if (!ingredient.case_size || !ingredient.price) return null;
  return ingredient.price / ingredient.case_size;
}

// Calculate cost of a recipe row
function calcRecipeCost(row, ingredients) {
  const ing = ingredients.find(i => i.name.toLowerCase() === row.ingredient_name?.toLowerCase());
  if (!ing) return Number(row.cost) || 0; // fallback to manual cost
  const unitCost = getUnitCost(ing);
  if (!unitCost) return Number(row.cost) || 0;
  // Convert recipe quantity to case units
  const qty = Number(row.qty) || 0;
  const converted = convertUnits(qty, row.qty_unit, ing.case_unit);
  return unitCost * converted;
}

function calcMenuStats(item, ingredients = []) {
  const cost = (item.ingredients || []).reduce((s, row) => s + calcRecipeCost(row, ingredients), 0);
  const profit = Number(item.sale_price) - cost;
  const margin = item.sale_price > 0 ? (profit / item.sale_price) * 100 : 0;
  return { cost, profit, margin };
}

function getPriceAlerts(ingredients) {
  const grouped = {};
  ingredients.forEach((ing) => {
    const key = ing.name.trim().toLowerCase();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ing);
  });
  const alerts = [];
  Object.values(grouped).forEach((entries) => {
    if (entries.length < 2) return;
    const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    const latest = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    if (!prev.price) return;
    const change = latest.price - prev.price;
    const pct = (change / prev.price) * 100;
    if (change !== 0) alerts.push({ name: latest.name, oldPrice: prev.price, newPrice: latest.price, pct, date: latest.date, unit: latest.unit });
  });
  return alerts.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
}

function exportCSV(ingredients, menuItems) {
  const rows = [["Type", "Name", "Supplier", "Date", "Case Price", "Case Size", "Case Unit", "Unit Cost", "Sale Price", "Food Cost", "Margin"]];
  ingredients.forEach((i) => {
    const uc = getUnitCost(i);
    rows.push(["Ingredient", i.name, i.supplier, i.date, fmt$2(i.price), i.case_size || "", i.case_unit || i.unit, uc ? fmt$(uc) : "", "", "", ""]);
  });
  menuItems.forEach((m) => {
    const { cost, margin } = calcMenuStats(m, ingredients);
    rows.push(["Menu Item", m.name, "", "", "", "", "", "", fmt$2(m.sale_price), fmt$2(cost), fmtPct(margin)]);
  });
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "kitcheniq-export.csv"; a.click();
}

// ─── Email Alert Sender ───────────────────────────────────────────────────────
async function sendPriceAlertEmail(userEmail, changes, menuItems, ingredients) {
  const bigChanges = changes.filter(c => Math.abs(c.pct) >= 8);
  if (!bigChanges.length) return;

  const itemLines = bigChanges.map(c => {
    const arrow = c.pct > 0 ? "🔴" : "🟢";
    const sign = c.pct > 0 ? "+" : "";
    // Find affected menu items
    const affected = menuItems.filter(m =>
      (m.ingredients || []).some(i => i.ingredient_name?.toLowerCase() === c.name.toLowerCase())
    );
    const affectedLine = affected.length ? `Affects: ${affected.map(m => m.name).join(", ")}` : "";
    return `${arrow} ${c.name}: $${Number(c.oldPrice).toFixed(2)} → $${Number(c.newPrice).toFixed(2)} (${sign}${c.pct.toFixed(1)}%)${affectedLine ? "\n   " + affectedLine : ""}`;
  }).join("\n\n");

  const subject = bigChanges.length === 1
    ? `⚠️ KitchenIQ Alert — ${bigChanges[0].name} price ${bigChanges[0].pct > 0 ? "increased" : "decreased"} ${Math.abs(bigChanges[0].pct).toFixed(0)}%`
    : `⚠️ KitchenIQ Alert — ${bigChanges.length} ingredient price changes detected`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0f1410; color: #e8f0e9; padding: 32px; border-radius: 12px;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 24px; font-weight: 800; color: #e8f0e9;">Kitchen<span style="color: #4eca6e;">IQ</span></span>
      </div>
      <h2 style="color: #e8f0e9; margin-bottom: 8px;">Price Change Alert</h2>
      <p style="color: #6b8a6e; margin-bottom: 24px;">We detected significant price changes on your latest invoice scan.</p>
      ${bigChanges.map(c => {
        const isUp = c.pct > 0;
        const sign = isUp ? "+" : "";
        const affected = menuItems.filter(m =>
          (m.ingredients || []).some(i => i.ingredient_name?.toLowerCase() === c.name.toLowerCase())
        );
        return `
        <div style="background: #161d17; border: 1px solid ${isUp ? "#e8854a55" : "#4eca6e55"}; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 16px; font-weight: 700; color: #e8f0e9;">${c.name}</span>
            <span style="font-size: 20px; font-weight: 800; color: ${isUp ? "#e8854a" : "#4eca6e"};">${isUp ? "▲" : "▼"} ${sign}${c.pct.toFixed(1)}%</span>
          </div>
          <div style="color: #6b8a6e; font-size: 14px; margin-bottom: 8px;">
            $${Number(c.oldPrice).toFixed(2)} → $${Number(c.newPrice).toFixed(2)} per ${c.unit || "unit"}
          </div>
          ${affected.length ? `<div style="color: #6b8a6e; font-size: 13px;">Affects menu items: <strong style="color: #e8f0e9;">${affected.map(m => m.name).join(", ")}</strong></div>` : ""}
        </div>`;
      }).join("")}
      <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #1e2b1f;">
        <a href="https://trykitcheniq.com" style="background: #4eca6e; color: #0f1410; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">View Full Breakdown →</a>
      </div>
      <p style="color: #2a3a2b; font-size: 12px; margin-top: 24px;">KitchenIQ · trykitcheniq.com</p>
    </div>
  `;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "KitchenIQ Alerts <alerts@trykitcheniq.com>",
        to: [userEmail],
        subject,
        html,
      })
    });
  } catch (e) {
    console.error("Failed to send alert email:", e);
  }
}

const T = {
  bg: "#0f1410", card: "#161d17", border: "#1e2b1f",
  accent: "#4eca6e", accentDim: "#4eca6e22", accentMid: "#4eca6e55",
  warn: "#e8854a", warnDim: "#e8854a22",
  text: "#e8f0e9", muted: "#6b8a6e", faint: "#2a3a2b",
  font: "'Syne', sans-serif", body: "'DM Sans', sans-serif",
};

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${accent ? T.accentMid : T.border}`, borderRadius: 10, padding: "20px 24px", flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, color: accent ? T.accent : T.text, fontFamily: T.font, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: T.muted, marginTop: 6, fontFamily: T.body }}>{sub}</div>}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", small, disabled }) {
  const styles = {
    primary: { background: T.accent, color: "#0f1410", border: "none" },
    ghost: { background: "transparent", color: T.muted, border: `1px solid ${T.border}` },
    danger: { background: T.warnDim, color: T.warn, border: `1px solid ${T.warn}44` },
    ai: { background: "linear-gradient(135deg, #4eca6e22, #6e4eca22)", color: T.accent, border: `1px solid ${T.accentMid}` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles[variant], borderRadius: 6, padding: small ? "6px 14px" : "10px 20px",
      fontSize: small ? 12 : 13, fontFamily: T.font, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1, transition: "opacity 0.15s", letterSpacing: "0.03em",
    }}>{children}</button>
  );
}

function Input({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ fontSize: 11, color: T.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: T.body }}>{label}</label>}
      <input value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder}
        style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 6, padding: "10px 14px", color: T.text, fontSize: 13, fontFamily: T.body, outline: "none", width: "100%", boxSizing: "border-box" }} />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ fontSize: 11, color: T.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: T.body }}>{label}</label>}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 6, padding: "10px 14px", color: T.text, fontSize: 13, fontFamily: T.body, outline: "none", width: "100%", boxSizing: "border-box" }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontFamily: T.font, fontSize: 18, color: T.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const UNIT_OPTIONS = [
  { value: "lb", label: "lb" },
  { value: "oz", label: "oz" },
  { value: "g", label: "g" },
  { value: "each", label: "each" },
  { value: "case", label: "case" },
  { value: "pack", label: "pack" },
  { value: "bag", label: "bag" },
];

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const submit = async () => {
    setLoading(true); setError(null); setMessage(null);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage("Check your email to confirm your account, then log in.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: T.accentDim, border: `1px solid ${T.accentMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>⬡</div>
          <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 28, color: T.text }}>Kitchen<span style={{ color: T.accent }}>IQ</span></div>
          <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, marginTop: 6 }}>Restaurant cost intelligence</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 32 }}>
          <div style={{ display: "flex", gap: 4, background: T.faint, borderRadius: 8, padding: 4, marginBottom: 28 }}>
            {["login", "signup"].map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(null); setMessage(null); }} style={{
                flex: 1, padding: "8px 0", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13,
                fontFamily: T.font, fontWeight: 600, letterSpacing: "0.03em",
                background: mode === m ? T.accent : "transparent",
                color: mode === m ? "#0f1410" : T.muted, transition: "all 0.15s",
              }}>{m === "login" ? "Log In" : "Sign Up"}</button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Email" value={email} onChange={setEmail} type="email" placeholder="you@restaurant.com" />
            <Input label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" />
            {error && <div style={{ background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 6, padding: "10px 14px", fontSize: 13, color: T.warn, fontFamily: T.body }}>{error}</div>}
            {message && <div style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 6, padding: "10px 14px", fontSize: 13, color: T.accent, fontFamily: T.body }}>{message}</div>}
            <button onClick={submit} disabled={loading || !email || !password} style={{
              background: T.accent, color: "#0f1410", border: "none", borderRadius: 8,
              padding: "13px 20px", fontSize: 14, fontFamily: T.font, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, marginTop: 4,
            }}>{loading ? "..." : mode === "login" ? "Log In" : "Create Account"}</button>
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: T.muted, fontFamily: T.body }}>Your data is encrypted and stored securely</div>
      </div>
    </div>
  );
}

// ─── Invoice Scanner ──────────────────────────────────────────────────────────
function InvoiceScanner({ onIngredientsFound, onClose }) {
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = (file) => {
    if (!file) return;
    setResults(null); setError(null);
    setImage(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = (e) => setImageBase64(e.target.result.split(",")[1]);
    reader.readAsDataURL(file);
  };

  const scan = async () => {
    if (!imageBase64) return;
    setScanning(true); setError(null);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-opus-4-5",
          max_tokens: 2048,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
              { type: "text", text: `You are a restaurant invoice parser. Analyze this supplier invoice image and extract every product line item.

Return ONLY a raw JSON array. No markdown, no backticks, no explanation, no preamble.

For each line item extract:
- name: the product name, cleaned up but ONLY using words actually printed on the invoice. Remove item numbers, SKU codes, and quantity descriptors. NEVER guess, infer, or substitute words not on the invoice. If you cannot read a word clearly, skip it rather than guess. Examples: 'BACON SLICED 18/14-16CT' becomes 'Bacon Sliced'. 'SAUSAGE LINKS ITALIAN SWEET PORK' becomes 'Italian Sweet Sausage'. 'CHEDDAR JACK CHEESE SHREDDED CASAIMP' becomes 'Cheddar Jack Cheese Shredded' — drop the unreadable code, never replace it with a guess.
- price: the UNIT price — cost per single unit, NOT the extended/total line price. If invoice shows QTY 4 x $12.50 = $50.00 then price is 12.50 not 50.00
- case_size: the quantity inside one case/unit. Look for formats like "4/5LB" (case_size=20 total lbs), "2/10LB" (case_size=20), "24CT" (case_size=24), "12/1LB" (case_size=12). If sold by weight per lb, case_size is the number of lbs in the case. If sold each, case_size is the count per case. If not visible, set to null.
- case_unit: the unit that case_size is measured in. Use: "lb", "oz", "each", "case", "pack", "bag". This is what ONE unit inside the case is measured in. Example: for "4/5LB bags of flour", case_unit is "lb" and case_size is 20.
- unit: same as case_unit — the base unit for one item
- supplier: vendor/company name from invoice header (or "Unknown")
- date: invoice date YYYY-MM-DD format (use ${today()} if not visible)

Critical rules:
- ONE JSON object per invoice line item. Never split one line into two, never combine two lines into one.
- Never guess or infer product names. Only use words visibly printed on the invoice.
- If a line item is unclear, include it with your best literal reading rather than skipping it.

Invoice layout hints:
- Sysco/US Foods columns: Item# | Description | Pack/Size | QTY | Unit Price | Extended Price — always use Unit Price column, never Extended Price. Pack/Size column contains the case_size info.
- For any invoice: find the per-unit cost, not the line total

Example output:
[{"name":"Bacon Sliced","price":42.50,"case_size":15,"case_unit":"lb","unit":"lb","supplier":"Sysco","date":"${today()}"},{"name":"Cheddar Jack Cheese Shredded","price":28.00,"case_size":4,"case_unit":"lb","unit":"lb","supplier":"Sysco","date":"${today()}"},{"name":"Eggs Large","price":3.20,"case_size":30,"case_unit":"each","unit":"each","supplier":"Local Farm","date":"${today()}"}]` }
            ]
          }]
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const text = data.content[0].text.trim();
      const parsed = JSON.parse(text);
      setResults(parsed);
    } catch (e) {
      setError("Couldn't read the invoice. Try a clearer photo with good lighting.");
    }
    setScanning(false);
  };

  const updateResult = (i, field, val) => {
    setResults(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  };

  const confirmImport = () => {
    onIngredientsFound(results.map((r) => ({ ...r, price: Number(r.price), case_size: r.case_size ? Number(r.case_size) : null })));
    onClose();
  };

  return (
    <Modal title="📸 AI Invoice Scanner" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: T.accent, fontFamily: T.body }}>
          ✨ AI reads your invoice and extracts ingredients, prices, and case sizes automatically
        </div>
        <div onClick={() => document.getElementById("invoice-upload").click()} style={{
          border: `2px dashed ${image ? T.accentMid : T.border}`, borderRadius: 10,
          padding: "28px 20px", textAlign: "center", cursor: "pointer",
          background: image ? T.accentDim : T.faint, transition: "all 0.2s",
        }}>
          {image
            ? <img src={image} alt="Invoice" style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 6, objectFit: "contain" }} />
            : <>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 600 }}>Upload Invoice Photo</div>
                <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 4 }}>JPG or PNG · Works with phone camera shots</div>
              </>}
          <input id="invoice-upload" type="file" accept="image/*" capture="environment"
            style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
        </div>
        {image && !results && <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, textAlign: "center" }}>✓ Image loaded — click Scan to extract ingredients</div>}
        {error && <div style={{ background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 6, padding: "10px 14px", fontSize: 13, color: T.warn, fontFamily: T.body }}>⚠ {error}</div>}

        {results && (
          <div>
            <div style={{ fontSize: 11, color: T.accent, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 6 }}>✓ Found {results.length} items — review and edit below</div>
            <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, marginBottom: 10 }}>Tap any field to correct it before importing</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
              {results.map((r, i) => (
                <div key={i} style={{ background: T.faint, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 70px", gap: 6 }}>
                    <input value={r.name} onChange={(e) => updateResult(i, "name", e.target.value)}
                      style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, padding: "6px 10px", color: T.text, fontSize: 12, fontFamily: T.body, outline: "none" }} />
                    <input value={r.price} onChange={(e) => updateResult(i, "price", e.target.value)} placeholder="Price"
                      style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, padding: "6px 10px", color: T.accent, fontSize: 12, fontFamily: T.body, outline: "none" }} />
                    <input value={r.case_size || ""} onChange={(e) => updateResult(i, "case_size", e.target.value)} placeholder="Size"
                      style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, padding: "6px 10px", color: T.text, fontSize: 12, fontFamily: T.body, outline: "none" }} />
                    <select value={r.case_unit || "lb"} onChange={(e) => updateResult(i, "case_unit", e.target.value)}
                      style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, padding: "6px 8px", color: T.text, fontSize: 12, fontFamily: T.body, outline: "none" }}>
                      {["lb","oz","each","case","pack","bag","g"].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: T.body, marginTop: 5 }}>
                    {r.case_size ? `Unit cost: $${(r.price / r.case_size).toFixed(4)} per ${r.case_unit}` : "⚠ Add case size to auto-calculate unit cost"}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, marginTop: 8 }}>Columns: Name · Case Price · Case Size · Unit</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          {!results
            ? <Btn onClick={scan} disabled={!imageBase64 || scanning} variant="ai">{scanning ? "⏳ Scanning..." : "🔍 Scan Invoice"}</Btn>
            : <>
                <Btn variant="ghost" onClick={() => { setResults(null); setImage(null); setImageBase64(null); }}>Rescan</Btn>
                <Btn onClick={confirmImport}>✓ Import {results.length} Items</Btn>
              </>}
        </div>
      </div>
    </Modal>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ ingredients, menuItems, onNavigate }) {
  const alerts = getPriceAlerts(ingredients);

  // Price history chart state
  const ingredientNames = [...new Set(ingredients.map(i => i.name))].sort();
  const [selectedIngredient, setSelectedIngredient] = useState(ingredientNames[0] || "");
  const priceHistory = ingredients
    .filter(i => i.name === selectedIngredient)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(i => ({ date: i.date, price: i.price }));
  const menuStats = menuItems.map((m) => ({ ...m, ...calcMenuStats(m, ingredients) }));
  const best = menuStats.length ? menuStats.reduce((a, b) => a.margin > b.margin ? a : b) : null;
  const worst = menuStats.length ? menuStats.reduce((a, b) => a.margin < b.margin ? a : b) : null;
  const avgMargin = menuStats.length ? menuStats.reduce((s, m) => s + m.margin, 0) / menuStats.length : 0;
  const marginData = menuStats.slice(0, 8).map((m) => ({ name: m.name.slice(0, 10), margin: parseFloat(m.margin.toFixed(1)) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <OnboardingBanner ingredients={ingredients} menuItems={menuItems} onNavigate={onNavigate} />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatCard label="Ingredients Tracked" value={ingredients.length} accent />
        <StatCard label="Menu Items" value={menuItems.length} />
        <StatCard label="Avg Margin" value={fmtPct(avgMargin)} sub={avgMargin > 60 ? "Healthy ✓" : avgMargin > 40 ? "Watch closely" : "⚠ Low"} accent={avgMargin > 60} />
        <StatCard label="Price Alerts" value={alerts.length} sub={alerts.length ? alerts[0].name : "All stable"} accent={alerts.length === 0} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body }}>Price History</div>
            {ingredientNames.length > 0 && (
              <select value={selectedIngredient} onChange={(e) => setSelectedIngredient(e.target.value)}
                style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 10px", color: T.text, fontSize: 12, fontFamily: T.body, outline: "none" }}>
                {ingredientNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
          </div>
          {priceHistory.length === 0
            ? <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 13, fontFamily: T.body }}>Add ingredients to see price history</div>
            : priceHistory.length === 1
            ? <div style={{ height: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <div style={{ fontSize: 28, color: T.accent, fontFamily: T.font, fontWeight: 800 }}>${priceHistory[0].price}</div>
                <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>Only one price recorded — scan another invoice to see trend</div>
              </div>
            : <ResponsiveContainer width="100%" height={160}>
                <LineChart data={priceHistory}>
                  <XAxis dataKey="date" tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, fontFamily: T.body, fontSize: 12 }}
                    formatter={(v) => [`$${Number(v).toFixed(2)}`, "Price"]} />
                  <Line type="monotone" dataKey="price" stroke={T.accent} strokeWidth={2} dot={{ fill: T.accent, r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>}
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 16 }}>Menu Item Margins</div>
          {marginData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={marginData}>
                <XAxis dataKey="name" tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, fontFamily: T.body, fontSize: 12 }} formatter={(v) => [`${v}%`, "Margin"]} />
                <Bar dataKey="margin" radius={[4, 4, 0, 0]}>
                  {marginData.map((entry, i) => (<Cell key={i} fill={entry.margin > 60 ? T.accent : entry.margin > 40 ? "#e8c84a" : T.warn} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 13, fontFamily: T.body }}>Add menu items to see chart</div>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 16 }}>Margin Leaders</div>
          {best ? (<>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>🏆 Best</span>
              <span style={{ fontSize: 13, color: T.accent, fontFamily: T.font, fontWeight: 600 }}>{best.name} — {fmtPct(best.margin)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>⚠ Worst</span>
              <span style={{ fontSize: 13, color: T.warn, fontFamily: T.font, fontWeight: 600 }}>{worst.name} — {fmtPct(worst.margin)}</span>
            </div>
          </>) : <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>No menu items yet</div>}
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 16 }}>Price Spike Alerts</div>
          {alerts.length === 0
            ? <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>No price changes detected yet</div>
            : alerts.slice(0, 3).map((a, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: T.text, fontFamily: T.body }}>{a.name}</span>
                <span style={{ fontSize: 13, fontFamily: T.font, fontWeight: 600, color: a.pct > 0 ? T.warn : T.accent }}>
                  {a.pct > 0 ? "▲" : "▼"} {Math.abs(a.pct).toFixed(1)}%
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── Ingredients ──────────────────────────────────────────────────────────────
function IngredientsView({ ingredients, setIngredients, userId, userEmail, menuItems }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", supplier: "", date: today(), price: "", case_size: "", case_unit: "lb" });
  const [editId, setEditId] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setForm({ name: "", supplier: "", date: today(), price: "", case_size: "", case_unit: "lb" }); setEditId(null); setModal("form"); };
  const openEdit = (ing) => {
    setForm({ name: ing.name, supplier: ing.supplier || "", date: ing.date || today(), price: String(ing.price), case_size: String(ing.case_size || ""), case_unit: ing.case_unit || "lb" });
    setEditId(ing.id); setModal("form");
  };

  const unitCostPreview = () => {
    if (!form.price || !form.case_size) return null;
    return (parseFloat(form.price) / parseFloat(form.case_size)).toFixed(4);
  };

  const save = async () => {
    if (!form.name || !form.price) return alert("Name and price are required.");
    setSaving(true);
    const entry = {
      name: form.name, supplier: form.supplier, date: form.date,
      price: parseFloat(form.price),
      case_size: form.case_size ? parseFloat(form.case_size) : null,
      case_unit: form.case_unit,
      unit: form.case_unit,
      user_id: userId
    };
    if (editId) {
      const { data, error } = await supabase.from("ingredients").update(entry).eq("id", editId).select();
      if (!error) setIngredients((prev) => prev.map((i) => i.id === editId ? data[0] : i));
    } else {
      const { data, error } = await supabase.from("ingredients").insert(entry).select();
      if (!error) setIngredients((prev) => [...prev, data[0]]);
    }
    setSaving(false); setModal(null);
  };

  const del = async (id) => {
    if (!window.confirm("Delete this ingredient?")) return;
    await supabase.from("ingredients").delete().eq("id", id);
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  };

  const handleScanned = async (items) => {
    setSaving(true);
    const rows = items.map((r) => ({ name: r.name, supplier: r.supplier, date: r.date, price: r.price, case_size: r.case_size || null, case_unit: r.case_unit || r.unit, unit: r.unit, user_id: userId }));
    const { data, error } = await supabase.from("ingredients").insert(rows).select();
    if (!error) {
      const newIngredients = [...ingredients, ...data];
      setIngredients(newIngredients);
      // Detect price changes and send alerts
      const changes = [];
      items.forEach(item => {
        const existing = ingredients.filter(i => i.name.toLowerCase() === item.name.toLowerCase())
          .sort((a, b) => new Date(b.date) - new Date(a.date));
        if (existing.length > 0) {
          const prev = existing[0];
          const pct = ((item.price - prev.price) / prev.price) * 100;
          if (Math.abs(pct) >= 5) {
            changes.push({ name: item.name, oldPrice: prev.price, newPrice: item.price, pct, unit: item.unit });
          }
        }
      });
      if (changes.some(c => Math.abs(c.pct) >= 8)) {
        await sendPriceAlertEmail(userEmail, changes, menuItems, newIngredients);
      }
    }
    setSaving(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body }}>{ingredients.length} ingredients tracked</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="ai" onClick={() => setShowScanner(true)}>📸 Scan Invoice</Btn>
          <Btn onClick={openAdd}>+ Add Manual</Btn>
        </div>
      </div>

      {ingredients.length === 0 && (
        <div style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 10, padding: "32px 28px", marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📸</div>
          <div style={{ fontSize: 15, color: T.accent, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>Skip the manual entry</div>
          <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, marginBottom: 16 }}>Take a photo of your supplier invoice and AI fills everything in automatically</div>
          <Btn variant="ai" onClick={() => setShowScanner(true)}>📸 Scan Your First Invoice</Btn>
        </div>
      )}

      {ingredients.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ingredients.map((ing) => {
            const uc = getUnitCost(ing);
            return (
              <div key={ing.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 600 }}>{ing.name}</div>
                  <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 3 }}>
                    {ing.supplier} · {ing.date}
                    {ing.case_size ? ` · ${ing.case_size} ${ing.case_unit} per case` : ""}
                  </div>
                  {uc && <div style={{ fontSize: 11, color: T.accent, fontFamily: T.body, marginTop: 2 }}>Unit cost: ${uc.toFixed(4)}/{ing.case_unit}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, color: T.accent, fontFamily: T.font, fontWeight: 700 }}>{fmt$2(ing.price)}</div>
                    <div style={{ fontSize: 10, color: T.muted, fontFamily: T.body }}>per case</div>
                  </div>
                  <Btn small variant="ghost" onClick={() => openEdit(ing)}>Edit</Btn>
                  <Btn small variant="danger" onClick={() => del(ing.id)}>Del</Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showScanner && <InvoiceScanner onIngredientsFound={handleScanned} onClose={() => setShowScanner(false)} />}

      {modal === "form" && (
        <Modal title={editId ? "Edit Ingredient" : "Add Ingredient"} onClose={() => setModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Ingredient Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Input label="Supplier" value={form.supplier} onChange={(v) => setForm({ ...form, supplier: v })} />
            <Input label="Date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} placeholder="YYYY-MM-DD" />
            <Input label="Case Price ($)" value={form.price} onChange={(v) => setForm({ ...form, price: v })} type="number" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Case Size" value={form.case_size} onChange={(v) => setForm({ ...form, case_size: v })} type="number" placeholder="e.g. 40, 24, 6" />
              <Select label="Unit" value={form.case_unit} onChange={(v) => setForm({ ...form, case_unit: v })} options={UNIT_OPTIONS} />
            </div>
            {unitCostPreview() && (
              <div style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 6, padding: "10px 14px", fontSize: 13, color: T.accent, fontFamily: T.body }}>
                ✓ Unit cost: ${unitCostPreview()} per {form.case_unit}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setModal(null)}>Cancel</Btn>
              <Btn onClick={save} disabled={saving}>{saving ? "Saving..." : editId ? "Save Changes" : "Add Ingredient"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Menu Scanner ────────────────────────────────────────────────────────────
function MenuScanner({ onMenuFound, onClose }) {
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = (file) => {
    if (!file) return;
    setResults(null); setError(null);
    setImage(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = (e) => setImageBase64(e.target.result.split(",")[1]);
    reader.readAsDataURL(file);
  };

  const scan = async () => {
    if (!imageBase64) return;
    setScanning(true); setError(null);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-opus-4-5",
          max_tokens: 2048,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
              { type: "text", text: `You are reading a restaurant menu. Extract every menu item and its price.

Return ONLY a raw JSON array. No markdown, no backticks, no explanation.

For each item extract:
- name: the menu item name, clean and readable. Keep it short. Examples: "Bacon Cheeseburger", "Eggs Benedict", "French Toast", "House Salad"
- price: the sale price as a number (e.g. 12.99). If a range, use the higher price. Never include $ signs.
- category: the menu section it belongs to if visible (e.g. "Breakfast", "Lunch", "Sides", "Drinks"). Use "Menu" if not clear.

Critical rules:
- ONE object per menu item
- Never include modifiers, add-ons, or combo options as separate items unless they have their own price
- Skip items with no price listed
- If a price is listed as a range like $10-14, use 14

Example output:
[{"name":"Bacon Cheeseburger","price":13.99,"category":"Lunch"},{"name":"French Toast","price":9.99,"category":"Breakfast"},{"name":"House Salad","price":7.50,"category":"Sides"}]` }
            ]
          }]
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const text = data.content[0].text.trim();
      const parsed = JSON.parse(text);
      setResults(parsed);
    } catch (e) {
      setError("Couldn't read the menu. Try a clearer photo with good lighting.");
    }
    setScanning(false);
  };

  const updateResult = (i, field, val) => {
    setResults(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  };

  const removeResult = (i) => setResults(prev => prev.filter((_, idx) => idx !== i));

  const confirmImport = () => {
    onMenuFound(results.map((r) => ({ name: r.name, sale_price: Number(r.price), category: r.category, ingredients: [] })));
    onClose();
  };

  return (
    <Modal title="📷 AI Menu Scanner" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: T.accent, fontFamily: T.body }}>
          ✨ Take a photo of your printed menu — AI reads every item and price instantly
        </div>
        <div onClick={() => document.getElementById("menu-upload").click()} style={{
          border: `2px dashed ${image ? T.accentMid : T.border}`, borderRadius: 10,
          padding: "28px 20px", textAlign: "center", cursor: "pointer",
          background: image ? T.accentDim : T.faint, transition: "all 0.2s",
        }}>
          {image
            ? <img src={image} alt="Menu" style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 6, objectFit: "contain" }} />
            : <>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🍽</div>
                <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 600 }}>Upload Menu Photo</div>
                <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 4 }}>Works with printed menus, chalkboards, menu boards</div>
              </>}
          <input id="menu-upload" type="file" accept="image/*" capture="environment"
            style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
        </div>

        {image && !results && <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, textAlign: "center" }}>✓ Image loaded — click Scan to extract menu items</div>}
        {error && <div style={{ background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 6, padding: "10px 14px", fontSize: 13, color: T.warn, fontFamily: T.body }}>⚠ {error}</div>}

        {results && (
          <div>
            <div style={{ fontSize: 11, color: T.accent, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 6 }}>✓ Found {results.length} items — review before importing</div>
            <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, marginBottom: 10 }}>You'll add ingredient recipes to each item after importing</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
              {results.map((r, i) => (
                <div key={i} style={{ background: T.faint, borderRadius: 8, padding: "10px 12px", display: "flex", gap: 8, alignItems: "center" }}>
                  <input value={r.name} onChange={(e) => updateResult(i, "name", e.target.value)}
                    style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, padding: "6px 10px", color: T.text, fontSize: 13, fontFamily: T.body, outline: "none" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 13, color: T.muted }}>$</span>
                    <input value={r.price} onChange={(e) => updateResult(i, "price", e.target.value)} type="number"
                      style={{ width: 70, background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, padding: "6px 8px", color: T.accent, fontSize: 13, fontFamily: T.body, outline: "none" }} />
                  </div>
                  <input value={r.category} onChange={(e) => updateResult(i, "category", e.target.value)}
                    style={{ width: 90, background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, padding: "6px 8px", color: T.muted, fontSize: 11, fontFamily: T.body, outline: "none" }} />
                  <button onClick={() => removeResult(i)} style={{ background: "none", border: "none", color: T.warn, cursor: "pointer", fontSize: 16, padding: "0 4px" }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, marginTop: 8 }}>Columns: Item Name · Price · Category (tap × to remove)</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          {!results
            ? <Btn onClick={scan} disabled={!imageBase64 || scanning} variant="ai">{scanning ? "⏳ Scanning..." : "🔍 Scan Menu"}</Btn>
            : <>
                <Btn variant="ghost" onClick={() => { setResults(null); setImage(null); setImageBase64(null); }}>Rescan</Btn>
                <Btn onClick={confirmImport}>✓ Import {results.length} Items</Btn>
              </>}
        </div>
      </div>
    </Modal>
  );
}

// ─── Menu Items ───────────────────────────────────────────────────────────────
function MenuView({ menuItems, setMenuItems, ingredients, userId }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", salePrice: "", ingredients: [{ ingredient_name: "", qty: "", qty_unit: "oz" }] });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showMenuScanner, setShowMenuScanner] = useState(false);

  const handleScannedMenu = async (items) => {
    setSaving(true);
    const rows = items.map((r) => ({ name: r.name, sale_price: r.sale_price, ingredients: [], user_id: userId }));
    const { data, error } = await supabase.from("menu_items").insert(rows).select();
    if (!error) setMenuItems((prev) => [...prev, ...data]);
    setSaving(false);
  };

  const openAdd = () => { setForm({ name: "", salePrice: "", ingredients: [{ ingredient_name: "", qty: "", qty_unit: "oz" }] }); setEditId(null); setModal("form"); };
  const openEdit = (m) => {
    setForm({ name: m.name, salePrice: String(m.sale_price), ingredients: (m.ingredients || []).map((i) => ({ ingredient_name: i.ingredient_name, qty: String(i.qty || ""), qty_unit: i.qty_unit || "oz" })) });
    setEditId(m.id); setModal("form");
  };
  const addRow = () => setForm((f) => ({ ...f, ingredients: [...f.ingredients, { ingredient_name: "", qty: "", qty_unit: "oz" }] }));
  const updateRow = (i, field, val) => setForm((f) => ({ ...f, ingredients: f.ingredients.map((row, idx) => idx === i ? { ...row, [field]: val } : row) }));

  // Live cost preview inside the form
  const previewCost = () => {
    return form.ingredients.reduce((total, row) => {
      const ing = ingredients.find(i => i.name.toLowerCase() === row.ingredient_name?.toLowerCase());
      if (!ing || !row.qty) return total;
      const uc = getUnitCost(ing);
      if (!uc) return total;
      const converted = convertUnits(Number(row.qty), row.qty_unit, ing.case_unit);
      return total + (uc * converted);
    }, 0);
  };

  const save = async () => {
    if (!form.name || !form.salePrice) return alert("Please enter name and sale price.");
    const ings = form.ingredients.filter((r) => r.ingredient_name && r.qty).map((r) => ({ ingredient_name: r.ingredient_name, qty: parseFloat(r.qty), qty_unit: r.qty_unit }));
    if (!ings.length) return alert("Add at least one ingredient.");
    setSaving(true);
    const entry = { name: form.name, sale_price: parseFloat(form.salePrice), ingredients: ings, user_id: userId };
    if (editId) {
      const { data, error } = await supabase.from("menu_items").update(entry).eq("id", editId).select();
      if (!error) setMenuItems((prev) => prev.map((m) => m.id === editId ? data[0] : m));
    } else {
      const { data, error } = await supabase.from("menu_items").insert(entry).select();
      if (!error) setMenuItems((prev) => [...prev, data[0]]);
    }
    setSaving(false); setModal(null);
  };

  const del = async (id) => {
    if (!window.confirm("Delete this menu item?")) return;
    await supabase.from("menu_items").delete().eq("id", id);
    setMenuItems((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body }}>{menuItems.length} menu items</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="ai" onClick={() => setShowMenuScanner(true)}>📷 Scan Menu</Btn>
          <Btn onClick={openAdd}>+ Add Manual</Btn>
        </div>
      </div>
      {menuItems.length === 0
        ? <div style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 10, padding: "32px 28px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
            <div style={{ fontSize: 15, color: T.accent, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>Scan your menu to get started</div>
            <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, marginBottom: 16 }}>Take a photo of your printed menu and AI imports all your items and prices instantly</div>
            <Btn variant="ai" onClick={() => setShowMenuScanner(true)}>📷 Scan Your Menu</Btn>
          </div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {menuItems.map((m) => {
            const { cost, profit, margin } = calcMenuStats(m, ingredients);
            const color = margin > 60 ? T.accent : margin > 40 ? "#e8c84a" : T.warn;
            return (
              <div key={m.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 15, color: T.text, fontFamily: T.font, fontWeight: 700 }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 4 }}>
                      {(m.ingredients || []).map((i) => `${i.qty}${i.qty_unit} ${i.ingredient_name}`).join(", ")}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, color, fontFamily: T.font, fontWeight: 800 }}>{fmtPct(margin)}</div>
                      <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>margin</div>
                    </div>
                    <Btn small variant="ghost" onClick={() => openEdit(m)}>Edit</Btn>
                    <Btn small variant="danger" onClick={() => del(m.id)}>Del</Btn>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 20, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.faint}` }}>
                  <span style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>Sale: <strong style={{ color: T.text }}>{fmt$2(m.sale_price)}</strong></span>
                  <span style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>Food Cost: <strong style={{ color: T.text }}>{fmt$2(cost)}</strong></span>
                  <span style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>Profit: <strong style={{ color: T.accent }}>{fmt$2(profit)}</strong></span>
                </div>
              </div>
            );
          })}
        </div>}

      {showMenuScanner && <MenuScanner onMenuFound={handleScannedMenu} onClose={() => setShowMenuScanner(false)} />}

      {modal === "form" && (
        <Modal title={editId ? "Edit Menu Item" : "Add Menu Item"} onClose={() => setModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Menu Item Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Input label="Sale Price ($)" value={form.salePrice} onChange={(v) => setForm({ ...form, salePrice: v })} type="number" />
            <div>
              <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 10 }}>Recipe (quantities per serving)</div>
              {form.ingredients.map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px", gap: 8, marginBottom: 8 }}>
                  <select value={row.ingredient_name} onChange={(e) => updateRow(i, "ingredient_name", e.target.value)}
                    style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 6, padding: "9px 12px", color: row.ingredient_name ? T.text : T.muted, fontSize: 13, fontFamily: T.body, outline: "none" }}>
                    <option value="">Select ingredient...</option>
                    {ingredients.map(ing => <option key={ing.id} value={ing.name}>{ing.name}</option>)}
                  </select>
                  <input value={row.qty} onChange={(e) => updateRow(i, "qty", e.target.value)}
                    placeholder="Qty" type="number"
                    style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 6, padding: "9px 10px", color: T.text, fontSize: 13, fontFamily: T.body, outline: "none" }} />
                  <select value={row.qty_unit} onChange={(e) => updateRow(i, "qty_unit", e.target.value)}
                    style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 6, padding: "9px 8px", color: T.text, fontSize: 13, fontFamily: T.body, outline: "none" }}>
                    {["oz","lb","g","each","pack","bag","case"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              ))}
              <button onClick={addRow} style={{ background: "none", border: `1px dashed ${T.border}`, borderRadius: 6, color: T.muted, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontFamily: T.body, width: "100%", marginTop: 4 }}>+ Add ingredient</button>
            </div>

            {/* Live cost preview */}
            {form.salePrice && (
              <div style={{ background: T.faint, borderRadius: 8, padding: "12px 16px" }}>
                {(() => {
                  const cost = previewCost();
                  const sale = parseFloat(form.salePrice) || 0;
                  const margin = sale > 0 ? ((sale - cost) / sale * 100) : 0;
                  const color = margin > 60 ? T.accent : margin > 40 ? "#e8c84a" : T.warn;
                  return (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>Food cost: {fmt$2(cost)}</div>
                        <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>Profit: {fmt$2(sale - cost)}</div>
                      </div>
                      <div style={{ fontSize: 24, color, fontFamily: T.font, fontWeight: 800 }}>{fmtPct(margin)}</div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setModal(null)}>Cancel</Btn>
              <Btn onClick={save} disabled={saving}>{saving ? "Saving..." : editId ? "Save Changes" : "Add Item"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Price Alerts ─────────────────────────────────────────────────────────────
function AlertsView({ ingredients }) {
  const alerts = getPriceAlerts(ingredients);
  return (
    <div>
      <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 20 }}>{alerts.length} price changes detected</div>
      {alerts.length === 0
        ? <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 40, textAlign: "center", color: T.muted, fontFamily: T.body }}>No price changes yet. You need at least 2 entries for the same ingredient.</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {alerts.map((a, i) => (
            <div key={i} style={{ background: T.card, border: `1px solid ${a.pct > 0 ? T.warn + "55" : T.accentMid}`, borderRadius: 10, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, color: T.text, fontFamily: T.font, fontWeight: 600 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 4 }}>{fmt$2(a.oldPrice)} → {fmt$2(a.newPrice)} · {a.unit} · {a.date}</div>
              </div>
              <div style={{ fontSize: 22, fontFamily: T.font, fontWeight: 800, color: a.pct > 0 ? T.warn : T.accent }}>
                {a.pct > 0 ? "▲" : "▼"} {Math.abs(a.pct).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>}
    </div>
  );
}


// ─── Onboarding Banner ────────────────────────────────────────────────────────
function OnboardingBanner({ ingredients, menuItems, onNavigate }) {
  const hasIngredients = ingredients.length > 0;
  const hasMenuItems = menuItems.length > 0;
  const hasRecipes = menuItems.some(m => (m.ingredients || []).length > 0);
  const allDone = hasIngredients && hasMenuItems && hasRecipes;

  if (allDone) return null;

  const steps = [
    {
      num: 1,
      done: hasIngredients,
      title: "Scan your invoices",
      desc: "Take a photo of any supplier invoice — AI reads every ingredient and price automatically",
      action: "Scan Invoice →",
      tab: 1,
    },
    {
      num: 2,
      done: hasMenuItems,
      title: "Scan your menu",
      desc: "Photo your printed menu and AI imports all your items and prices in seconds",
      action: "Scan Menu →",
      tab: 2,
    },
    {
      num: 3,
      done: hasRecipes,
      title: "Add recipes to menu items",
      desc: "Tell the app what ingredients go into each dish so margins calculate automatically",
      action: "Add Recipes →",
      tab: 2,
    },
  ];

  const currentStep = steps.find(s => !s.done) || steps[2];

  return (
    <div style={{ background: T.card, border: `1px solid ${T.accentMid}`, borderRadius: 12, padding: "24px 28px", marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 17, color: T.text, marginBottom: 4 }}>
            👋 Welcome to KitchenIQ
          </div>
          <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>
            Complete these 3 steps to see your restaurant's real margins
          </div>
        </div>
        <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, background: T.faint, borderRadius: 20, padding: "4px 12px" }}>
          {steps.filter(s => s.done).length}/3 done
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((step) => (
          <div key={step.num} style={{
            display: "flex", alignItems: "center", gap: 16,
            background: step.done ? T.accentDim : step.num === currentStep.num ? T.faint : "transparent",
            border: `1px solid ${step.done ? T.accentMid : step.num === currentStep.num ? T.border : "transparent"}`,
            borderRadius: 10, padding: "14px 18px", transition: "all 0.2s",
          }}>
            {/* Check or number */}
            <div style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              background: step.done ? T.accent : step.num === currentStep.num ? T.accentDim : T.faint,
              border: `2px solid ${step.done ? T.accent : step.num === currentStep.num ? T.accentMid : T.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: step.done ? 16 : 13, color: step.done ? "#0f1410" : step.num === currentStep.num ? T.accent : T.muted,
              fontFamily: T.font, fontWeight: 700,
            }}>
              {step.done ? "✓" : step.num}
            </div>

            {/* Text */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontFamily: T.font, fontWeight: 600, color: step.done ? T.muted : T.text, textDecoration: step.done ? "line-through" : "none" }}>
                {step.title}
              </div>
              {!step.done && (
                <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 2 }}>{step.desc}</div>
              )}
            </div>

            {/* Action button */}
            {!step.done && step.num === currentStep.num && (
              <button onClick={() => onNavigate(step.tab)} style={{
                background: T.accent, color: "#0f1410", border: "none", borderRadius: 6,
                padding: "8px 16px", fontSize: 12, fontFamily: T.font, fontWeight: 700,
                cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              }}>{step.action}</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────
const TABS = ["Dashboard", "Ingredients", "Menu Items", "Price Alerts"];
const ICONS = ["⬡", "🥬", "🍽", "⚡"];

export default function KitchenIQ() {
  const [session, setSession] = useState(undefined);
  const [tab, setTab] = useState(0);
  const [ingredients, setIngredients] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const load = async () => {
      setLoading(true);
      const [{ data: ings }, { data: menus }] = await Promise.all([
        supabase.from("ingredients").select("*").order("created_at", { ascending: false }),
        supabase.from("menu_items").select("*").order("created_at", { ascending: false }),
      ]);
      setIngredients(ings || []);
      setMenuItems(menus || []);
      setLoading(false);
    };
    load();
  }, [session]);

  const signOut = async () => { await supabase.auth.signOut(); setIngredients([]); setMenuItems([]); };

  if (session === undefined) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: T.accent, fontFamily: T.font, fontSize: 18 }}>Loading...</div>
    </div>
  );

  if (!session) return <AuthScreen />;

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: T.bg, fontFamily: T.body, color: T.text, boxSizing: "border-box", overflowX: "hidden" }}>
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: T.card, height: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: T.accentDim, border: `1px solid ${T.accentMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⬡</div>
          <span style={{ fontFamily: T.font, fontWeight: 800, fontSize: 18, color: T.text }}>Kitchen<span style={{ color: T.accent }}>IQ</span></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>{session.user.email}</span>
          <button onClick={() => exportCSV(ingredients, menuItems)}
            style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, color: T.accent, borderRadius: 6, padding: "7px 14px", fontSize: 12, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>↓ CSV</button>
          <button onClick={signOut}
            style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 6, padding: "7px 14px", fontSize: 12, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>Sign Out</button>
        </div>
      </div>
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "0 24px", display: "flex", background: T.card, overflowX: "auto" }}>
        {TABS.map((t, i) => {
            const alertCount = i === 3 ? getPriceAlerts(ingredients).length : 0;
            return (
              <button key={i} onClick={() => setTab(i)} style={{
                background: "none", border: "none", borderBottom: `2px solid ${tab === i ? T.accent : "transparent"}`,
                color: tab === i ? T.accent : T.muted, padding: "14px 20px", fontSize: 13, fontFamily: T.font,
                fontWeight: 600, cursor: "pointer", transition: "color 0.15s", letterSpacing: "0.03em", whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {ICONS[i]} {t}
                {alertCount > 0 && (
                  <span style={{ background: T.warn, color: "#fff", borderRadius: 10, fontSize: 10, padding: "2px 6px", fontFamily: T.font, fontWeight: 700, lineHeight: 1 }}>{alertCount}</span>
                )}
              </button>
            );
          })}
      </div>
      <div style={{ width: "100%", padding: "32px 24px", boxSizing: "border-box" }}>
        {loading
          ? <div style={{ textAlign: "center", color: T.muted, fontFamily: T.body, padding: 60 }}>Loading your data...</div>
          : <>
            {tab === 0 && <Dashboard ingredients={ingredients} menuItems={menuItems} onNavigate={setTab} />}
            {tab === 1 && <IngredientsView ingredients={ingredients} setIngredients={setIngredients} userId={session.user.id} userEmail={session.user.email} menuItems={menuItems} />}
            {tab === 2 && <MenuView menuItems={menuItems} setMenuItems={setMenuItems} ingredients={ingredients} userId={session.user.id} />}
            {tab === 3 && <AlertsView ingredients={ingredients} />}
          </>}
      </div>
    </div>
  );
}