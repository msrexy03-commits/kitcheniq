import { useState, useEffect, Component } from "react";
import { createClient } from "@supabase/supabase-js";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap";
document.head.appendChild(fontLink);

// Global animation styles
const animStyle = document.createElement("style");
animStyle.textContent = `
  @keyframes cardFlash { 0% { border-color: inherit; box-shadow: none; } 50% { border-color: #4eca6e; box-shadow: 0 0 16px #4eca6e33; } 100% { border-color: inherit; box-shadow: none; } }
  @keyframes slideInDown { from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes progress { from { width: 0% } to { width: 100% } }
  @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes tourPulse { 0%, 100% { box-shadow: 0 0 0 0 #4eca6e66, 0 12px 48px #000000cc; } 50% { box-shadow: 0 0 0 8px #4eca6e22, 0 12px 48px #000000cc; } }
  @keyframes demoReveal { 0% { opacity: 0; transform: scale(1.08); } 100% { opacity: 1; transform: scale(1); } }
  @keyframes demoScanLine { 0% { transform: translateY(-100%); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(100vh); opacity: 0; } }
  @keyframes demoRingPulse { 0% { transform: scale(0.6); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
  @keyframes demoFadeOut { 0% { opacity: 1; } 100% { opacity: 0; pointer-events: none; } }
  @keyframes demoLogoIn { 0% { opacity: 0; transform: scale(0.7); } 60% { opacity: 1; transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }
  @keyframes demoTextIn { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
  @keyframes demoGridIn { 0% { opacity: 0; transform: perspective(800px) rotateX(12deg) scale(0.95); } 100% { opacity: 1; transform: perspective(800px) rotateX(0deg) scale(1); } }
`;
document.head.appendChild(animStyle);

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const today = () => new Date().toISOString().split("T")[0];

// ─── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("KitchenIQ error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: "#0f1410", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: "#e8f0e9", marginBottom: 10 }}>
              Something went wrong
            </div>
            <div style={{ fontSize: 14, color: "#6b8a6e", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, marginBottom: 28 }}>
              KitchenIQ ran into an unexpected error. Your data is safe — try refreshing the page. If it keeps happening, contact jake@trykitcheniq.com.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{ background: "#4eca6e", color: "#0f1410", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 14, fontFamily: "'Syne', sans-serif", fontWeight: 700, cursor: "pointer", marginRight: 12 }}>
              Refresh Page
            </button>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{ background: "transparent", color: "#6b8a6e", border: "1px solid #1e2b1f", borderRadius: 8, padding: "12px 28px", fontSize: 14, fontFamily: "'Syne', sans-serif", fontWeight: 600, cursor: "pointer" }}>
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Responsive Hook ──────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}
const fmt$ = (n) => `$${Number(n).toFixed(4)}`;
const fmt$2 = (n) => `$${Number(n).toFixed(2)}`;
const fmtPct = (n) => `${Number(n).toFixed(1)}%`;

// ─── Unit cost calculator ─────────────────────────────────────────────────────
const UNIT_CONVERSIONS = {
  lb: { oz: 16, lb: 1, g: 453.592, slices: 16 },
  oz: { oz: 1, lb: 0.0625, g: 28.3495 },
  g: { g: 1, oz: 0.03527, lb: 0.002205 },
  each: { each: 1, slices: 1 },
  slices: { slices: 1, each: 1, oz: 1 },
  pack: { pack: 1 },
  case: { case: 1 },
  bag: { bag: 1 },
  gallon: { gallon: 1, oz: 128, cup: 16, quart: 4 },
  quart: { quart: 1, oz: 32, cup: 4, gallon: 0.25 },
  cup: { cup: 1, oz: 8, tbsp: 16, tsp: 48 },
  tbsp: { tbsp: 1, tsp: 3, oz: 0.5, cup: 0.0625 },
  tsp: { tsp: 1, tbsp: 0.333, oz: 0.1667 },
};

function convertUnits(value, fromUnit, toUnit) {
  const from = fromUnit?.toLowerCase();
  const to = toUnit?.toLowerCase();
  if (from === to) return value;
  if (UNIT_CONVERSIONS[from] && UNIT_CONVERSIONS[from][to] !== undefined) {
    return value * UNIT_CONVERSIONS[from][to];
  }
  return value;
}

function getUnitCost(ingredient) {
  if (!ingredient.case_size || !ingredient.price) return null;
  return ingredient.price / ingredient.case_size;
}

// ─── Ingredient Normalization ─────────────────────────────────────────────────
// Converts OCR-parsed ingredients into recipe-usable units before saving.
// Goal: case_unit should always match what a cook would use in a recipe row.
function normalizeIngredient(raw) {
  const name = (raw.name || "").toLowerCase();
  const packText = String(raw.pack_text || raw.case_size || "").toLowerCase();
  let { price, case_size, case_unit } = raw;
  case_size = Number(case_size) || null;
  case_unit = (case_unit || "each").toLowerCase();

  // ── EGGS: convert dozens to individual eggs ──────────────────────────────
  if (/egg/.test(name)) {
    // If stored as lb (rare but possible), leave it — cook by weight is fine
    if (case_unit === "lb" || case_unit === "oz") return { ...raw, case_size, case_unit };
    // Detect dozens: pack text like "15DZ", "30DOZ", "2.5DOZ", or case_unit === "dz"/"doz"/"dozen"
    const dozMatch = packText.match(/(\d*\.?\d+)\s*(?:dz|doz|dozen)/i)
      || (case_unit && /^(dz|doz|dozen)$/.test(case_unit) && case_size);
    if (dozMatch) {
      const dozens = dozMatch[1] ? parseFloat(dozMatch[1]) : case_size;
      return { ...raw, case_size: Math.round(dozens * 12), case_unit: "each", unit: "each" };
    }
    // Already stored as "each" — trust it only if case_size looks like egg count (>12)
    // If case_size looks like a dozen count (≤6), assume it means dozens
    if (case_unit === "each" && case_size && case_size <= 6) {
      return { ...raw, case_size: Math.round(case_size * 12), case_unit: "each", unit: "each" };
    }
    return { ...raw, case_size, case_unit: "each", unit: "each" };
  }

  // ── SLICED BREAD / TOAST / RYE / WHITE / WHEAT / SOURDOUGH ───────────────
  if (/\b(bread|toast|rye|sourdough|white bread|wheat bread|sliced)\b/.test(name) && !/bun|roll|bagel|english muffin/.test(name)) {
    // Look for slice count in pack text: "20SL", "15 SLICES", etc.
    const sliceMatch = packText.match(/(\d+)\s*(?:sl|slices?)/i);
    if (sliceMatch) {
      return { ...raw, case_size: parseInt(sliceMatch[1]), case_unit: "each", unit: "each" };
    }
    // If stored as loaf(ves), assume 20 slices per loaf
    if (/loaf|loaves/.test(packText) || /loaf/.test(case_unit)) {
      const loaves = case_size || 1;
      return { ...raw, case_size: loaves * 20, case_unit: "each", unit: "each" };
    }
    // If stored as lb, convert to oz for portioning
    if (case_unit === "lb" && case_size) {
      return { ...raw, case_size: Math.round(case_size * 16), case_unit: "oz", unit: "oz" };
    }
    return { ...raw, case_size, case_unit: "each", unit: "each" };
  }

  // ── BUNS, ROLLS, BAGELS, ENGLISH MUFFINS ─────────────────────────────────
  if (/\b(bun|roll|bagel|english muffin|kaiser|brioche bun|slider bun)\b/.test(name)) {
    if (case_unit === "lb" && case_size) {
      return { ...raw, case_size: Math.round(case_size * 16), case_unit: "oz", unit: "oz" };
    }
    return { ...raw, case_size, case_unit: "each", unit: "each" };
  }

  // ── BURGER PATTIES, SAUSAGE PATTIES, SAUSAGE LINKS ───────────────────────
  if (/\b(patty|patties|sausage link|sausage patty|burger patty)\b/.test(name)) {
    // Often stored as lb but recipes use "each" — if count available use it
    const ctMatch = packText.match(/(\d+)\s*(?:ct|count|pc|pcs)/i);
    if (ctMatch) return { ...raw, case_size: parseInt(ctMatch[1]), case_unit: "each", unit: "each" };
    // If lb, convert to oz
    if (case_unit === "lb" && case_size) {
      return { ...raw, case_size: Math.round(case_size * 16), case_unit: "oz", unit: "oz" };
    }
    return { ...raw, case_size, case_unit: "each", unit: "each" };
  }

  // ── SLICED CHEESE (individual slices) ─────────────────────────────────────
  if (/\b(sliced cheese|american cheese|cheese slice|singles)\b/.test(name)) {
    const ctMatch = packText.match(/(\d+)\s*(?:ct|slices?|pc)/i);
    if (ctMatch) return { ...raw, case_size: parseInt(ctMatch[1]), case_unit: "each", unit: "each" };
    if (case_unit === "lb" && case_size) {
      return { ...raw, case_size: Math.round(case_size * 16), case_unit: "oz", unit: "oz" };
    }
    return { ...raw, case_size, case_unit: "each", unit: "each" };
  }

  // ── BACON: count-based strips ─────────────────────────────────────────────
  if (/\bbacon\b/.test(name)) {
    // Sysco-style "18/14-16CT" means 18 packs of ~15 strips — if count detected, use each
    const ctMatch = packText.match(/(\d+)\s*ct/i) || raw.name.match(/(\d+)\s*ct/i);
    if (ctMatch) return { ...raw, case_size: parseInt(ctMatch[1]), case_unit: "each", unit: "each" };
    // Otherwise store as lb (weight-based portioning is fine for bacon)
    if (case_unit === "lb") return { ...raw, case_size, case_unit: "lb", unit: "lb" };
    if (case_unit === "each" && case_size) return { ...raw, case_size, case_unit: "each", unit: "each" };
    return { ...raw, case_size, case_unit };
  }

  // ── WEIGHT-BASED: meats, shredded cheese, bulk items → convert lb to oz ──
  const weightBasedPattern = /\b(beef|chicken|turkey|pork|ham|steak|tenderloin|sirloin|brisket|salmon|tuna|tilapia|shrimp|scallop|lobster|crab|fish|ground|deli meat|roast beef|pastrami|corned beef|shredded cheese|cheddar shredded|mozzarella shredded|cheese shredded|provolone|swiss|fries|potato|pasta|rice|noodle|sauce|dressing|mayo|ketchup|mustard|ranch|aioli|butter|margarine|lard|oil|shortening)\b/.test(name);
  if (weightBasedPattern && case_unit === "lb" && case_size) {
    return { ...raw, case_size: Math.round(case_size * 16), case_unit: "oz", unit: "oz" };
  }

  // ── DEFAULT: pass through unchanged ──────────────────────────────────────
  return { ...raw, case_size, case_unit, unit: case_unit };
}

function calcRecipeCost(row, ingredients) {
  const rowKey = normalizeNameForGrouping(row.ingredient_name || "");
  const matches = ingredients.filter(i => normalizeNameForGrouping(i.name) === rowKey);
  const ing = matches.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  if (!ing) return Number(row.cost) || 0;
  const unitCost = getUnitCost(ing);
  if (!unitCost) return Number(row.cost) || 0;
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

// Normalize ingredient name for fuzzy grouping —
// strips trailing 's', collapses whitespace, lowercases
// so "Egg Shell" and "Eggs Shell" group together
function normalizeNameForGrouping(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")         // collapse whitespace
    .replace(/(\w)s\b/g, "$1")    // strip trailing 's' from words (eggs→egg, potatoes→potato)
    .replace(/[^a-z0-9 ]/g, "")  // strip special chars
    .trim();
}

function getPriceAlerts(ingredients) {
  const grouped = {};
  ingredients.forEach((ing) => {
    const key = normalizeNameForGrouping(ing.name);
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
    await fetch("/api/send-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: userEmail, subject, html }),
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
    <div style={{ background: T.card, border: `1px solid ${accent ? T.accentMid : T.border}`, borderRadius: 10, padding: "16px 20px", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, color: accent ? T.accent : T.text, fontFamily: T.font, fontWeight: 800, lineHeight: 1 }}>{value}</div>
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

// Ingredient case units — how suppliers sell it
const UNIT_OPTIONS = [
  { value: "oz", label: "oz (ounces)" },
  { value: "lb", label: "lb (pounds)" },
  { value: "each", label: "each (pieces / eggs / slices)" },
  { value: "gallon", label: "gallon" },
  { value: "quart", label: "quart" },
  { value: "bag", label: "bag" },
  { value: "case", label: "case" },
  { value: "pack", label: "pack" },
  { value: "g", label: "g (grams)" },
];

// Recipe row units — how a cook measures per serving
const RECIPE_UNIT_OPTIONS = [
  { value: "oz", label: "oz (meat, bacon, cheese, sauces)" },
  { value: "each", label: "each (eggs, buns, patties, pieces)" },
  { value: "slices", label: "slices (bread, cheese slices)" },
  { value: "tbsp", label: "tbsp" },
  { value: "tsp", label: "tsp" },
  { value: "cup", label: "cup" },
  { value: "lb", label: "lb" },
  { value: "gallon", label: "gallon" },
  { value: "g", label: "g" },
];

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onBack }) {
  const [mode, setMode] = useState("login"); // login | signup | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setPulse(p => !p), 600);
    return () => clearInterval(interval);
  }, []);

  const switchMode = (m) => { setMode(m); setError(null); setMessage(null); };

  const [showTransition, setShowTransition] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState("Signing you in...");

  const submit = async () => {
    setLoading(true); setError(null); setMessage(null);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); }
      else { setTransitionMessage("Signing you in..."); setShowTransition(true); }
    } else if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); }
      else if (data?.user) { setTransitionMessage("Creating your account..."); setShowTransition(true); }
    } else if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://trykitcheniq.com",
      });
      if (error) setError(error.message);
      else setMessage("reset_sent");
      setLoading(false);
    }
  };

  // Transition is a pure visual overlay — Supabase session change will naturally
  // unmount AuthScreen once auth propagates. No onComplete needed.
  if (showTransition) return (
    <AppTransition
      message={transitionMessage}
      submessage="Getting your restaurant ready"
      duration={2500}
    />
  );

  // Success screen after signup
  if (message === "success") return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: T.accentDim, border: `2px solid ${T.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 24px", boxShadow: `0 0 32px ${T.accent}44` }}>✓</div>
        <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 26, color: T.text, marginBottom: 10 }}>You're in!</div>
        <div style={{ fontSize: 14, color: T.muted, fontFamily: T.body, marginBottom: 8, lineHeight: 1.6 }}>
          Account created successfully for <strong style={{ color: T.text }}>{email}</strong>
        </div>
        <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, marginBottom: 32 }}>You'll be taken to your dashboard automatically...</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent, opacity: pulse ? (i === 0 ? 1 : i === 1 ? 0.6 : 0.3) : (i === 0 ? 0.3 : i === 1 ? 0.6 : 1), transition: "opacity 0.5s ease" }} />
          ))}
        </div>
      </div>
    </div>
  );

  // Reset email sent confirmation
  if (message === "reset_sent") return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: T.accentDim, border: `2px solid ${T.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 24px", boxShadow: `0 0 32px ${T.accent}44` }}>📧</div>
        <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 26, color: T.text, marginBottom: 10 }}>Check your email</div>
        <div style={{ fontSize: 14, color: T.muted, fontFamily: T.body, marginBottom: 8, lineHeight: 1.6 }}>
          We sent a password reset link to <strong style={{ color: T.text }}>{email}</strong>
        </div>
        <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, marginBottom: 32 }}>Click the link in the email to set a new password. Check your spam folder if you don't see it.</div>
        <button onClick={() => switchMode("login")} style={{ background: "none", border: "none", color: T.accent, fontSize: 13, fontFamily: T.body, cursor: "pointer", textDecoration: "underline" }}>
          Back to log in
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, fontFamily: T.body, cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
            ← Back to demo
          </button>
        )}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: T.accentDim, border: `1px solid ${T.accentMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>⬡</div>
          <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 28, color: T.text }}>Kitchen<span style={{ color: T.accent }}>IQ</span></div>
          <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, marginTop: 6 }}>Restaurant cost intelligence</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 32 }}>

          {/* Mode tabs — hidden on reset screen */}
          {mode !== "reset" && (
            <div style={{ display: "flex", gap: 4, background: T.faint, borderRadius: 8, padding: 4, marginBottom: 28 }}>
              {["login", "signup"].map((m) => (
                <button key={m} onClick={() => switchMode(m)} style={{
                  flex: 1, padding: "8px 0", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13,
                  fontFamily: T.font, fontWeight: 600, letterSpacing: "0.03em",
                  background: mode === m ? T.accent : "transparent",
                  color: mode === m ? "#0f1410" : T.muted, transition: "all 0.15s",
                }}>{m === "login" ? "Log In" : "Sign Up"}</button>
              ))}
            </div>
          )}

          {/* Reset header */}
          {mode === "reset" && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 18, color: T.text, marginBottom: 6 }}>Reset your password</div>
              <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>Enter your email and we'll send you a reset link.</div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Email" value={email} onChange={setEmail} type="email" placeholder="you@restaurant.com" />
            {mode !== "reset" && (
              <Input label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" />
            )}
            {error && (
              <div style={{ background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 6, padding: "10px 14px", fontSize: 13, color: T.warn, fontFamily: T.body }}>{error}</div>
            )}
            <button onClick={submit} disabled={loading || !email || (mode !== "reset" && !password)} style={{
              background: T.accent, color: "#0f1410", border: "none", borderRadius: 8,
              padding: "13px 20px", fontSize: 14, fontFamily: T.font, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, marginTop: 4,
            }}>
              {loading ? "Please wait..." : mode === "login" ? "Log In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
            </button>

            {/* Forgot password link — only on login */}
            {mode === "login" && (
              <button onClick={() => switchMode("reset")} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, fontFamily: T.body, cursor: "pointer", textAlign: "center", marginTop: -4 }}>
                Forgot your password?
              </button>
            )}

            {/* Back to login — only on reset */}
            {mode === "reset" && (
              <button onClick={() => switchMode("login")} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, fontFamily: T.body, cursor: "pointer", textAlign: "center", marginTop: -4 }}>
                ← Back to log in
              </button>
            )}
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: T.muted, fontFamily: T.body }}>Your data is encrypted and stored securely</div>
        <LegalLinks />
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
- name: See NAME NORMALIZATION RULES below. This is the most important field.
- price: the UNIT price — cost per single unit, NOT the extended/total line price. If invoice shows QTY 4 x $12.50 = $50.00 then price is 12.50 not 50.00
- case_size: the quantity inside one case/unit. Look for formats like "4/5LB" (case_size=20 total lbs), "2/10LB" (case_size=20), "24CT" (case_size=24), "12/1LB" (case_size=12). If sold by weight per lb, case_size is the number of lbs in the case. If sold each, case_size is the count per case. If not visible, set to null.
- case_unit: the unit that case_size is measured in. Use: "lb", "oz", "each", "case", "pack", "bag". This is what ONE unit inside the case is measured in. Example: for "4/5LB bags of flour", case_unit is "lb" and case_size is 20.
- unit: same as case_unit — the base unit for one item
- supplier: vendor/company name from invoice header (or "Unknown")
- date: invoice date YYYY-MM-DD format (use ${today()} if not visible)

NAME NORMALIZATION RULES — follow exactly:
1. FORMAT: Always write names as "Base Ingredient + Descriptor(s)" in that order. The ingredient type comes first, specific descriptors follow.
   - "SLICED BACON 18/14-16CT" → "Bacon Sliced"
   - "SWEET ITALIAN SAUSAGE LINKS" → "Sausage Sweet Italian"
   - "HOT SAUSAGE LINKS PORK" → "Sausage Hot"
   - "SAUSAGE PATTIES 2OZ" → "Sausage Patties"
   - "SHREDDED CHEDDAR JACK CHEESE" → "Cheese Cheddar Jack Shredded"
   - "GROUND BEEF 80/20" → "Beef Ground 80/20"
   - "CHICKEN BREAST BNLS SKNLS FZN" → "Chicken Breast Boneless"

2. STRIP completely — never include in name:
   - Supplier item codes, SKUs, or number strings (e.g. "SYS", "CASAIMP", "10432")
   - Pack/size specs that are already captured in case_size (e.g. "18/14-16CT", "4/5LB", "24CT")
   - Cooking state abbreviations when obvious (FZN=Frozen, BNLS=Boneless, SKNLS=Skinless) — spell out or omit
   - The word "PORK", "BEEF", "CHICKEN" only when it's already the base ingredient name

3. KEEP descriptors that distinguish one product from another:
   - Always keep: Sweet, Hot, Mild, Spicy, Italian, Smoked, Fresh, Ground, Sliced, Shredded, Whole, Diced, Patties, Links, Strips
   - Always keep: size grades (Large, Extra Large, Jumbo for eggs)
   - Always keep: fat ratios (80/20, 85/15 for ground beef)
   - NEVER drop a descriptor that would make two different products look the same

4. NEVER merge two separate line items into one, and NEVER split one line item into two.
   - "Sausage Sweet", "Sausage Hot", and "Sausage Patties" are THREE different items — keep them separate
   - Each invoice line = exactly one JSON object

5. Title Case all names. Never ALL CAPS.

Invoice layout hints:
- Sysco/US Foods columns: Item# | Description | Pack/Size | QTY | Unit Price | Extended Price — always use Unit Price column, never Extended Price. Pack/Size column contains the case_size info.
- For any invoice: find the per-unit cost, not the line total

Example output:
[{"name":"Bacon Sliced","price":42.50,"case_size":15,"case_unit":"lb","unit":"lb","supplier":"Sysco","date":"${today()}"},{"name":"Sausage Sweet Italian","price":38.00,"case_size":10,"case_unit":"lb","unit":"lb","supplier":"Sysco","date":"${today()}"},{"name":"Sausage Hot","price":36.50,"case_size":10,"case_unit":"lb","unit":"lb","supplier":"Sysco","date":"${today()}"},{"name":"Sausage Patties","price":32.00,"case_size":160,"case_unit":"each","unit":"each","supplier":"Sysco","date":"${today()}"},{"name":"Cheese Cheddar Jack Shredded","price":28.00,"case_size":4,"case_unit":"lb","unit":"lb","supplier":"Sysco","date":"${today()}"},{"name":"Eggs Large","price":3.20,"case_size":30,"case_unit":"each","unit":"each","supplier":"Local Farm","date":"${today()}"}]` }
            ]
          }]
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      let text = data.content[0].text.trim();
      // Strip markdown code fences if model accidentally includes them
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("No items found");
      setResults(parsed.map(r => normalizeIngredient(r)));
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
            <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, marginBottom: 10 }}>Units normalized for recipe use (eggs = each egg, lbs → oz). Tap any field to correct.</div>
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
                    <select value={r.case_unit || "oz"} onChange={(e) => updateResult(i, "case_unit", e.target.value)}
                      style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, padding: "6px 8px", color: T.text, fontSize: 12, fontFamily: T.body, outline: "none" }}>
                      {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
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
function Dashboard({ ingredients, menuItems, onNavigate, flashCard: externalFlash, chartOpacity: externalChartOpacity, tier }) {
  const [internalFlash, setInternalFlash] = useState(null);
  const [chartOpacity, setChartOpacity] = useState(externalChartOpacity ?? 0);
  const flashCard = externalFlash ?? internalFlash;

  useEffect(() => {
    if (externalChartOpacity === undefined) setTimeout(() => setChartOpacity(1), 400);
    if (externalFlash === undefined) {
      const cards = ["ingredients", "menu", "margin", "alerts"];
      let idx = 0;
      const interval = setInterval(() => {
        setInternalFlash(cards[idx % cards.length]);
        idx++;
        setTimeout(() => setInternalFlash(null), 900);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, []);
  const alerts = getPriceAlerts(ingredients);

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
      <OnboardingBanner ingredients={ingredients} menuItems={menuItems} onNavigate={onNavigate} tier={tier} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        {[
          { key: "ingredients", label: "Ingredients Tracked", value: ingredients.length, accent: true },
          { key: "menu", label: "Menu Items", value: menuItems.length, accent: false },
          { key: "margin", label: "Avg Margin", value: fmtPct(avgMargin), sub: avgMargin > 60 ? "Healthy ✓" : avgMargin > 40 ? "Watch closely" : "⚠ Low margins", accent: avgMargin > 60, warn: avgMargin < 50 },
          { key: "alerts", label: "Price Alerts", value: alerts.length, sub: alerts.length ? alerts[0].name : "All stable", accent: alerts.length === 0, warn: alerts.length > 0 },
        ].map(card => (
          <div key={card.key} style={{
            background: T.card,
            border: `1px solid ${card.warn ? T.warn + "88" : card.accent ? T.accentMid : T.border}`,
            borderRadius: 10, padding: "16px 20px",
            animation: flashCard === card.key ? "cardFlash 0.9s ease" : "none",
            transition: "border-color 0.3s ease",
          }}>
            <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: 32, color: card.warn ? T.warn : card.accent ? T.accent : T.text, fontFamily: T.font, fontWeight: 800, lineHeight: 1 }}>{card.value}</div>
            {card.sub && <div style={{ fontSize: 12, color: card.warn ? T.warn : T.muted, marginTop: 6, fontFamily: T.body }}>{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Menu Suggestions Panel ── */}
      {tier === "tracker" ? (
        <div style={{ background: T.card, border: `1px solid ${T.accentMid}`, borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 28 }}>🔒</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 4 }}>Menu margins & recipe costing are on the Full plan</div>
            <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>You're on Tracker — upgrade to see your real food cost % on every dish.</div>
          </div>
          <a href="/#/paywall" style={{ background: T.accent, color: "#0f1410", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontFamily: T.font, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>Upgrade →</a>
        </div>
      ) : menuStats.length > 0 && (() => {
        const suggestions = menuStats.map(m => {
          const issues = [];
          if (m.margin < 50 && m.cost > 0) {
            const suggestedPrice = m.cost / (1 - 0.65);
            const diff = suggestedPrice - m.sale_price;
            issues.push({ type: "price", label: "Low Margin", color: T.warn, bg: T.warnDim, border: `${T.warn}44`, icon: "💰", message: `Raise to ${fmt$2(suggestedPrice)} (+${fmt$2(diff)}) to hit 65% margin`, urgency: 2 });
          }
          // Check if any ingredient spiked recently (within last 30 days)
          const recentSpikes = alerts.filter(a =>
            (m.ingredients || []).some(r => r.ingredient_name?.toLowerCase() === a.name?.toLowerCase())
          );
          if (recentSpikes.length > 0) {
            const spike = recentSpikes[0];
            issues.push({ type: "spike", label: "Price Spike", color: "#e8c84a", bg: "#e8c84a11", border: "#e8c84a44", icon: "⚡", message: `${spike.name} changed — review your margin`, urgency: 1 });
          }
          return issues.length > 0 ? { ...m, issues } : null;
        }).filter(Boolean).sort((a, b) => Math.max(...b.issues.map(i => i.urgency)) - Math.max(...a.issues.map(i => i.urgency)));

        if (suggestions.length === 0) return (
          <div style={{ background: T.card, border: `1px solid ${T.accentMid}`, borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 8 }}>Menu Suggestions</div>
            <div style={{ fontSize: 14, color: T.accent, fontFamily: T.body }}>✓ All menu items are looking healthy — no action needed right now.</div>
          </div>
        );

        return (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body }}>Menu Suggestions</div>
              <div style={{ fontSize: 12, color: T.warn, fontFamily: T.font, fontWeight: 700 }}>{suggestions.length} item{suggestions.length > 1 ? "s" : ""} need attention</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {suggestions.map((m, idx) => (
                <div key={idx} style={{ background: T.faint, borderRadius: 10, padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700 }}>{m.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 16, color: m.margin < 50 ? T.warn : "#e8c84a", fontFamily: T.font, fontWeight: 800 }}>{fmtPct(m.margin)}</div>
                      <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>margin</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {m.issues.map((issue, i) => (
                      <div key={i} style={{ background: issue.bg, border: `1px solid ${issue.border}`, borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 16 }}>{issue.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: issue.color, fontFamily: T.font, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>{issue.label}</div>
                          <div style={{ fontSize: 13, color: T.text, fontFamily: T.body }}>{issue.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => onNavigate(2)} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontFamily: T.body, cursor: "pointer", marginTop: 12, textDecoration: "underline", padding: 0 }}>
              View all menu items →
            </button>
          </div>
        );
      })()}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
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
                  {marginData.map((entry, i) => (<Cell key={i} fill={entry.margin > 60 ? T.accent : entry.margin > 40 ? "#e8c84a" : T.warn} opacity={entry.margin < 40 ? 1 : 0.85} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 13, fontFamily: T.body }}>Add menu items to see chart</div>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
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
function IngredientsView({ ingredients, setIngredients, userId, userEmail, menuItems, onPriceChange }) {
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
      if (!error) {
        const newIngredients = [...ingredients, data[0]];
        setIngredients(newIngredients);
        // Check for price change on manual add too
        const existing = ingredients.filter(i => i.name.toLowerCase() === entry.name.toLowerCase())
          .sort((a, b) => new Date(b.date) - new Date(a.date));
        if (existing.length > 0) {
          const prev = existing[0];
          const pct = ((entry.price - prev.price) / prev.price) * 100;
          if (Math.abs(pct) >= 8) {
            const affectedDishes = menuItems.map(m => {
              const row = (m.ingredients || []).find(r => r.ingredient_name?.toLowerCase() === entry.name.toLowerCase());
              if (!row) return null;
              const oldIng = { ...prev };
              const newIng = { name: entry.name, price: entry.price, case_size: entry.case_size, case_unit: entry.case_unit };
              const oldCost = calcRecipeCost(row, [oldIng]);
              const newCost = calcRecipeCost(row, [newIng]);
              const impact = newCost - oldCost;
              if (Math.abs(impact) < 0.10) return null;
              return { dish: m.name, impact };
            }).filter(Boolean);
            const change = { name: entry.name, oldPrice: prev.price, newPrice: entry.price, pct, unit: entry.case_unit, affectedDishes };
            if (onPriceChange) onPriceChange([change]);
            if (Math.abs(pct) >= 8) {
              await sendPriceAlertEmail(userEmail, [change], menuItems, newIngredients);
            }
          }
        }
      }
    }
    setSaving(false); setModal(null);
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const del = async (id) => {
    await supabase.from("ingredients").delete().eq("id", id);
    setIngredients((prev) => prev.filter((i) => i.id !== id));
    setConfirmDeleteId(null);
  };

  const [dupToast, setDupToast] = useState(false);

  const handleScanned = async (items) => {
    // Duplicate detection — check if same supplier + same date already exists
    if (items.length > 0) {
      const supplier = items[0].supplier?.trim().toLowerCase();
      const date = items[0].date;
      if (supplier && date) {
        const alreadyExists = ingredients.some(
          i => i.supplier?.trim().toLowerCase() === supplier && i.date === date
        );
        if (alreadyExists) {
          setDupToast(true);
          setTimeout(() => setDupToast(false), 5000);
          return;
        }
      }
    }

    setSaving(true);
    const rows = items.map((r) => ({ name: r.name, supplier: r.supplier, date: r.date, price: r.price, case_size: r.case_size || null, case_unit: r.case_unit || r.unit, unit: r.unit, user_id: userId }));
    const { data, error } = await supabase.from("ingredients").insert(rows).select();
    if (!error) {
      const newIngredients = [...ingredients, ...data];
      setIngredients(newIngredients);
      const changes = [];
      items.forEach(item => {
        const existing = ingredients.filter(i => i.name.toLowerCase() === item.name.toLowerCase())
          .sort((a, b) => new Date(b.date) - new Date(a.date));
        if (existing.length > 0) {
          const prev = existing[0];
          const pct = ((item.price - prev.price) / prev.price) * 100;
          if (Math.abs(pct) >= 8) {
            // Calculate per-dish dollar impact for each affected menu item
            const affectedDishes = menuItems.map(m => {
              const row = (m.ingredients || []).find(r => r.ingredient_name?.toLowerCase() === item.name.toLowerCase());
              if (!row) return null;
              // Cost with old price
              const oldIng = { ...prev };
              const newIng = { name: item.name, price: item.price, case_size: item.case_size || prev.case_size, case_unit: item.case_unit || prev.case_unit };
              const oldCost = calcRecipeCost(row, [oldIng]);
              const newCost = calcRecipeCost(row, [newIng]);
              const impact = newCost - oldCost;
              if (Math.abs(impact) < 0.10) return null; // ignore trivial impacts
              return { dish: m.name, impact };
            }).filter(Boolean);
            changes.push({ name: item.name, oldPrice: prev.price, newPrice: item.price, pct, unit: item.unit, affectedDishes });
          }
        }
      });
      if (changes.length > 0 && onPriceChange) onPriceChange(changes);
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

      {ingredients.length > 0 && (() => {
        const grouped = {};
        ingredients.forEach(ing => {
          const key = ing.date || "Unknown Date";
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(ing);
        });
        const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
        sortedDates.forEach(date => { grouped[date].sort((a, b) => a.name.localeCompare(b.name)); });
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {sortedDates.map(date => (
              <div key={date}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: T.accent, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, fontWeight: 600 }}>📄 {date}</div>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                  <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>{grouped[date].length} items · {grouped[date][0]?.supplier || ""}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {grouped[date].map(ing => {
                    const uc = getUnitCost(ing);
                    return (
                      <div key={ing.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 600 }}>{ing.name}</div>
                          <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 3 }}>{ing.case_size ? `${ing.case_size} ${ing.case_unit} per case` : "No case size"}</div>
                          {uc && <div style={{ fontSize: 11, color: T.accent, fontFamily: T.body, marginTop: 2 }}>Unit cost: ${uc.toFixed(4)}/{ing.case_unit}</div>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 16, color: T.accent, fontFamily: T.font, fontWeight: 700 }}>{fmt$2(ing.price)}</div>
                            <div style={{ fontSize: 10, color: T.muted, fontFamily: T.body }}>per case</div>
                          </div>
                          <Btn small variant="ghost" onClick={() => openEdit(ing)}>Edit</Btn>
                          {confirmDeleteId === ing.id ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 11, color: T.warn, fontFamily: T.body }}>Sure?</span>
                              <Btn small variant="danger" onClick={() => del(ing.id)}>Yes</Btn>
                              <Btn small variant="ghost" onClick={() => setConfirmDeleteId(null)}>No</Btn>
                            </div>
                          ) : (
                            <Btn small variant="danger" onClick={() => setConfirmDeleteId(ing.id)}>Del</Btn>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {dupToast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: T.card, border: `1px solid ${T.accentMid}`,
          borderRadius: 12, padding: "16px 24px", zIndex: 200,
          display: "flex", alignItems: "center", gap: 12,
          boxShadow: "0 8px 32px #00000066",
          animation: "slideInDown 0.3s ease",
          maxWidth: 420, width: "calc(100% - 32px)",
        }}>
          <div style={{ fontSize: 24 }}>👀</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 3 }}>Looks like you already scanned this one!</div>
            <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>We found an existing invoice from the same supplier and date. Import skipped to avoid duplicates.</div>
          </div>
          <button onClick={() => setDupToast(false)} style={{ background: "none", border: "none", color: T.muted, fontSize: 18, cursor: "pointer", padding: "0 4px", flexShrink: 0 }}>×</button>
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

// ─── Menu Scanner ─────────────────────────────────────────────────────────────
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
      let text = data.content[0].text.trim();
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("No items found");
      setResults(parsed);
    } catch (e) {
      setError("Couldn't read the menu. Try a clearer photo with good lighting.");
    }
    setScanning(false);
  };

  const updateResult = (i, field, val) => setResults(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
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
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuestions, setAiQuestions] = useState([]); // [{question, type: "yesno"|"number"|"text", key}]
  const [aiAnswers, setAiAnswers] = useState({});
  const [aiPendingSuggestion, setAiPendingSuggestion] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);

  // Deduplicated ingredient list — one entry per unique name, using most recent price
  const uniqueIngredients = Object.values(
    ingredients.reduce((acc, ing) => {
      const key = ing.name.toLowerCase();
      if (!acc[key] || new Date(ing.date) > new Date(acc[key].date)) acc[key] = ing;
      return acc;
    }, {})
  ).sort((a, b) => a.name.localeCompare(b.name));

  const [skippedDupes, setSkippedDupes] = useState(0);

  const handleScannedMenu = async (items) => {
    setSaving(true);
    // Filter out dishes that already exist by name (case-insensitive)
    const existingNames = new Set(menuItems.map(m => m.name.toLowerCase().trim()));
    const newItems = items.filter(r => !existingNames.has(r.name.toLowerCase().trim()));
    const dupes = items.length - newItems.length;
    if (dupes > 0) setSkippedDupes(dupes);
    if (newItems.length > 0) {
      const rows = newItems.map((r) => ({ name: r.name, sale_price: r.sale_price, ingredients: [], user_id: userId }));
      const { data, error } = await supabase.from("menu_items").insert(rows).select();
      if (!error) setMenuItems((prev) => [...prev, ...data]);
    }
    setSaving(false);
  };

  const openAdd = () => { setForm({ name: "", salePrice: "", ingredients: [{ ingredient_name: "", qty: "", qty_unit: "oz" }] }); setEditId(null); setModal("form"); };
  const openEdit = (m) => {
    setForm({ name: m.name, salePrice: String(m.sale_price), ingredients: (m.ingredients || []).map((i) => ({ ingredient_name: i.ingredient_name, qty: String(i.qty || ""), qty_unit: i.qty_unit || "oz" })) });
    setEditId(m.id); setModal("form");
  };
  const addRow = () => setForm((f) => ({ ...f, ingredients: [...f.ingredients, { ingredient_name: "", qty: "", qty_unit: "oz" }] }));
  const updateRow = (i, field, val) => setForm((f) => {
    const updated = f.ingredients.map((row, idx) => {
      if (idx !== i) return row;
      const newRow = { ...row, [field]: val };
      // Auto-set unit when ingredient is selected
      if (field === "ingredient_name") {
        const match = uniqueIngredients.find(ing => ing.name === val);
        if (match) newRow.qty_unit = match.case_unit || match.unit || "oz";
      }
      return newRow;
    });
    return { ...f, ingredients: updated };
  });
  const removeRow = (i) => setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, idx) => idx !== i) }));

  const [aiError, setAiError] = useState(null);
  const [questionVisible, setQuestionVisible] = useState(true);

  const suggestRecipe = async () => {
    if (!form.name) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const ingredientList = uniqueIngredients.map(i => {
        // Units are already normalized — use them directly.
        // oz for weight-based, each (= 1 piece) for countable items.
        const unit = i.case_unit || i.unit || "oz";
        return `${i.name} (recipe unit: "${unit}" means one ${unit === "each" ? "piece/egg/slice/strip" : unit})`;
      }).join("\n");

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
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: `You are helping a restaurant owner build a recipe cost calculator for their menu item.

Menu item: "${form.name}"
Available ingredients (use the EXACT unit shown — units are already normalized to recipe scale):
${ingredientList}

FIRST — check if this is a real food item that would appear on a restaurant menu.
If it is NOT real food (e.g. nonsense words, celebrity names, memes, gibberish), return:
{"not_food": true, "recipe": [], "questions": []}

If it IS real food, suggest which ingredients are likely in this dish with realistic PER-SERVING quantities.

CRITICAL UNIT RULES — the units are already correct, just use them:
- "each" for eggs means 1 egg — use 2 or 3 for a typical dish, never 0.16
- "each" for bread/buns/patties/links/slices means 1 piece — use whole numbers
- "oz" for meats means 1 ounce — use 4-8 oz for a typical protein portion
- "oz" for shredded cheese means 1 ounce — use 1-2 oz per serving
- NEVER use fractional "each" values like 0.083 or 0.16 — if the unit is "each", use whole numbers only

QUESTION RULES:
- Only ask if the answer changes cost meaningfully AND you genuinely cannot guess. Max 2 questions.
- Use "choice" type for which-one questions, never yes/no for those.
- Do NOT ask about ingredients not in the available list above.

Return ONLY raw JSON, no markdown, no backticks:
{
  "not_food": false,
  "recipe": [{"ingredient_name": "EXACT name from list above", "qty": 2, "qty_unit": "each"}],
  "questions": [
    {"key": "bread", "question": "Does this come with toast?", "type": "yesno", "if_yes": [{"ingredient_name": "EXACT name", "qty": 2, "qty_unit": "each"}]},
    {"key": "patty_size", "question": "How many oz is the patty?", "type": "number", "ingredient_name": "EXACT name", "qty_unit": "oz"},
    {"key": "bun_type", "question": "What type of bun?", "type": "choice", "options": [{"label": "Brioche Bun", "ingredient_name": "EXACT name", "qty": 1, "qty_unit": "each"}]}
  ]
}

- ingredient_name must be EXACTLY as listed above
- Only include ingredients actually in their list
- If nothing unclear, return empty questions array`
          }]
        })
      });
      const data = await response.json();
      let text = data.content[0].text.trim();
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const parsed = JSON.parse(text);

      if (parsed.not_food) {
        setAiError(`"${form.name}" doesn't look like a menu item. Try a real dish name like "Cheeseburger" or "Grilled Chicken Sandwich".`);
        setAiLoading(false);
        return;
      }

      // Apply base recipe — match ingredient names case-insensitively to what's in the dropdown
      if (parsed.recipe && parsed.recipe.length > 0) {
        const matched = parsed.recipe.map(r => {
          const match = uniqueIngredients.find(
            ing => ing.name.toLowerCase() === r.ingredient_name.toLowerCase()
          );
          return {
            ingredient_name: match ? match.name : r.ingredient_name,
            qty: String(r.qty),
            qty_unit: r.qty_unit,
          };
        }).filter(r => uniqueIngredients.some(ing => ing.name === r.ingredient_name));
        if (matched.length > 0) {
          setForm(f => ({ ...f, ingredients: matched }));
        }
      }

      // If there are questions, show questionnaire
      if (parsed.questions && parsed.questions.length > 0) {
        // Also case-insensitive match ingredient names in questions
        const fixedQuestions = parsed.questions.map(q => {
          const fix = (name) => {
            const match = uniqueIngredients.find(i => i.name.toLowerCase() === name?.toLowerCase());
            return match ? match.name : name;
          };
          return {
            ...q,
            ingredient_name: q.ingredient_name ? fix(q.ingredient_name) : undefined,
            if_yes: q.if_yes ? q.if_yes.map(r => ({ ...r, ingredient_name: fix(r.ingredient_name) })) : undefined,
          };
        });
        setAiPendingSuggestion(parsed);
        setAiQuestions(fixedQuestions);
        setAiAnswers({});
        setCurrentQuestion(0);
        setQuestionVisible(true);
        setShowQuestionnaire(true);
      }
    } catch (e) {
      // silently fail — form stays as is
    }
    setAiLoading(false);
  };

  const applyAnswer = (answer) => {
    const q = aiQuestions[currentQuestion];
    setAiAnswers(prev => ({ ...prev, [q.key]: answer }));

    // Apply answer to form immediately
    if (q.type === "yesno" && answer === "yes" && q.if_yes) {
      setForm(f => ({
        ...f,
        ingredients: [
          ...f.ingredients,
          ...q.if_yes.map(r => ({ ingredient_name: r.ingredient_name, qty: String(r.qty), qty_unit: r.qty_unit }))
        ]
      }));
    } else if (q.type === "number" && answer) {
      setForm(f => ({
        ...f,
        ingredients: f.ingredients.map(row =>
          row.ingredient_name === q.ingredient_name
            ? { ...row, qty: String(answer) }
            : row
        )
      }));
    } else if (q.type === "choice" && answer) {
      // answer is the chosen option object {label, ingredient_name, qty, qty_unit}
      setForm(f => ({
        ...f,
        ingredients: [
          ...f.ingredients.filter(row =>
            !q.options.some(opt => opt.ingredient_name === row.ingredient_name)
          ),
          { ingredient_name: answer.ingredient_name, qty: String(answer.qty), qty_unit: answer.qty_unit }
        ]
      }));
    }

    // Animate out, then move to next or close
    setQuestionVisible(false);
    setTimeout(() => {
      if (currentQuestion < aiQuestions.length - 1) {
        setCurrentQuestion(i => i + 1);
        setQuestionVisible(true);
      } else {
        setShowQuestionnaire(false);
        setAiQuestions([]);
      }
    }, 220);
  };

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

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const del = async (id) => {
    await supabase.from("menu_items").delete().eq("id", id);
    setMenuItems((prev) => prev.filter((m) => m.id !== id));
    setConfirmDeleteId(null);
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
            const color = margin > 65 ? T.accent : margin > 50 ? "#e8c84a" : T.warn;
            const isBad = margin < 50;
            // Calculate suggested price to hit 65% margin: price = cost / (1 - 0.65)
            const suggestedPrice = cost > 0 ? cost / (1 - 0.65) : null;
            const priceDiff = suggestedPrice ? suggestedPrice - m.sale_price : 0;
            // Find the biggest cost contributor for supplier switch suggestion
            const biggestIngredient = (m.ingredients || []).reduce((best, row) => {
              const c = calcRecipeCost(row, ingredients);
              return c > (best?.cost || 0) ? { ...row, cost: c } : best;
            }, null);
            return (
              <div key={m.id} style={{ background: T.card, border: `1px solid ${isBad ? T.warn + "66" : T.border}`, borderRadius: 10, padding: "16px 20px", boxShadow: isBad ? `0 0 16px ${T.warn}18` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, color: T.text, fontFamily: T.font, fontWeight: 700 }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 4 }}>{(m.ingredients || []).map((i) => `${i.qty}${i.qty_unit} ${i.ingredient_name}`).join(", ")}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: 12 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 20, color, fontFamily: T.font, fontWeight: 800 }}>{fmtPct(margin)}</div>
                      <div style={{ fontSize: 11, color: isBad ? T.warn : T.muted, fontFamily: T.body }}>{isBad ? "needs attention" : "margin"}</div>
                    </div>
                    <Btn small variant="ghost" onClick={() => openEdit(m)}>Edit</Btn>
                    {confirmDeleteId === m.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: T.warn, fontFamily: T.body }}>Sure?</span>
                        <Btn small variant="danger" onClick={() => del(m.id)}>Yes</Btn>
                        <Btn small variant="ghost" onClick={() => setConfirmDeleteId(null)}>No</Btn>
                      </div>
                    ) : (
                      <Btn small variant="danger" onClick={() => setConfirmDeleteId(m.id)}>Del</Btn>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 20, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.faint}` }}>
                  <span style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>Sale: <strong style={{ color: T.text }}>{fmt$2(m.sale_price)}</strong></span>
                  <span style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>Food Cost: <strong style={{ color: isBad ? T.warn : T.text }}>{fmt$2(cost)}</strong></span>
                  <span style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>Profit: <strong style={{ color: isBad ? T.warn : T.accent }}>{fmt$2(profit)}</strong></span>
                </div>

                {/* Pricing suggestion + supplier switch for low margin items */}
                {isBad && cost > 0 && (
                  <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {/* Price suggestion */}
                    <div style={{ flex: 1, minWidth: 200, background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ fontSize: 11, color: T.warn, fontFamily: T.font, fontWeight: 700, marginBottom: 4 }}>💰 Suggested Price</div>
                      <div style={{ fontSize: 13, color: T.text, fontFamily: T.body }}>
                        Raise to <strong style={{ color: T.warn }}>{fmt$2(suggestedPrice)}</strong>
                        <span style={{ color: T.muted }}> (+{fmt$2(priceDiff)})</span>
                        {" "}to hit 65% margin
                      </div>
                    </div>

                    {/* Switch supplier */}
                    {biggestIngredient && (
                      <div style={{ flex: 1, minWidth: 200, background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 8, padding: "10px 14px" }}>
                        <div style={{ fontSize: 11, color: T.accent, fontFamily: T.font, fontWeight: 700, marginBottom: 4 }}>🔄 Switch Supplier?</div>
                        <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginBottom: 8 }}>
                          {biggestIngredient.ingredient_name} is your biggest cost driver at {fmt$2(biggestIngredient.cost)}/serving
                        </div>
                        <button
                          onClick={() => window.open(`mailto:jake@trykitcheniq.com?subject=Supplier%20Switch%20Request&body=Hi%20Jake%2C%0A%0AI'd%20like%20to%20find%20a%20better%20price%20for%20${encodeURIComponent(biggestIngredient.ingredient_name)}%20for%20my%20${encodeURIComponent(m.name)}.%0A%0ACurrent%20cost%3A%20${encodeURIComponent(fmt$2(biggestIngredient.cost))}%20per%20serving%0A%0AThanks`, '_blank')}
                          style={{ background: T.accent, color: "#0f1410", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontFamily: T.font, fontWeight: 700, cursor: "pointer" }}>
                          Find Better Price →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>}

      {skippedDupes > 0 && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: T.card, border: `1px solid ${T.accentMid}`, borderRadius: 12, padding: "14px 20px", zIndex: 200, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 32px #00000066", maxWidth: 400, width: "calc(100% - 32px)", animation: "slideInDown 0.3s ease" }}>
          <div style={{ fontSize: 20 }}>✓</div>
          <div style={{ flex: 1, fontSize: 13, color: T.text, fontFamily: T.body }}>{skippedDupes} dish{skippedDupes > 1 ? "es" : ""} already exist and were skipped.</div>
          <button onClick={() => setSkippedDupes(0)} style={{ background: "none", border: "none", color: T.muted, fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
      )}
      {showMenuScanner && <MenuScanner onMenuFound={handleScannedMenu} onClose={() => setShowMenuScanner(false)} />}

      {modal === "form" && (
        <Modal title={editId ? "Edit Menu Item" : "Add Menu Item"} onClose={() => setModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Menu Item Name" value={form.name} onChange={(v) => { setForm({ ...form, name: v }); setAiError(null); }} />
            <Input label="Sale Price ($)" value={form.salePrice} onChange={(v) => setForm({ ...form, salePrice: v })} type="number" />

            {/* AI Suggest Button */}
            {uniqueIngredients.length > 0 && (
              <>
                <button onClick={suggestRecipe} disabled={aiLoading || !form.name} style={{
                  background: aiLoading || !form.name ? T.faint : "linear-gradient(135deg, #4eca6e33, #4eca6e11)",
                  border: `2px solid ${!form.name ? T.border : T.accent}`,
                  color: !form.name ? T.muted : T.accent,
                  borderRadius: 10, padding: "14px 16px", fontSize: 14,
                  fontFamily: T.font, fontWeight: 800,
                  cursor: aiLoading || !form.name ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  width: "100%", transition: "all 0.2s",
                  boxShadow: form.name && !aiLoading ? `0 0 20px #4eca6e22` : "none",
                  animation: form.name && !aiLoading ? "tourPulse 2s ease-in-out infinite" : "none",
                }}>
                  <span style={{ fontSize: 18 }}>✨</span>
                  <span>{aiLoading ? "AI is thinking..." : "Auto-Fill Recipe with AI"}</span>
                  {!aiLoading && !form.name && <span style={{ fontSize: 11, color: T.muted, fontFamily: T.body, fontWeight: 400 }}>— enter dish name first</span>}
                </button>
                {aiError && (
                  <div style={{ background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: T.warn, fontFamily: T.body }}>
                    🤔 {aiError}
                  </div>
                )}
              </>
            )}

            <div>
              <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 10 }}>Recipe (quantities per serving)</div>
              {form.ingredients.map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 28px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <select value={row.ingredient_name} onChange={(e) => updateRow(i, "ingredient_name", e.target.value)}
                    style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 6, padding: "9px 12px", color: row.ingredient_name ? T.text : T.muted, fontSize: 13, fontFamily: T.body, outline: "none" }}>
                    <option value="">Select ingredient...</option>
                    {uniqueIngredients.map(ing => <option key={ing.id} value={ing.name}>{ing.name}</option>)}
                  </select>
                  <input value={row.qty} onChange={(e) => updateRow(i, "qty", e.target.value)} placeholder="Qty" type="number"
                    style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 6, padding: "9px 10px", color: T.text, fontSize: 13, fontFamily: T.body, outline: "none" }} />
                  <select value={row.qty_unit} onChange={(e) => updateRow(i, "qty_unit", e.target.value)}
                    style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 6, padding: "9px 8px", color: T.text, fontSize: 13, fontFamily: T.body, outline: "none" }}>
                    {RECIPE_UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                  <button onClick={() => removeRow(i)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 16, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                </div>
              ))}
              <button onClick={addRow} style={{ background: "none", border: `1px dashed ${T.border}`, borderRadius: 6, color: T.muted, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontFamily: T.body, width: "100%", marginTop: 4 }}>+ Add ingredient</button>
            </div>
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

      {/* AI Questionnaire Modal */}
      {showQuestionnaire && aiQuestions[currentQuestion] && (
        <div style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: T.card, border: `2px solid ${T.accent}`, borderRadius: 16, width: "100%", maxWidth: 420, padding: 32, animation: "fadeIn 0.2s ease" }}>
            {/* Progress */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ background: T.accent, color: "#0f1410", borderRadius: 20, padding: "2px 12px", fontSize: 11, fontFamily: T.font, fontWeight: 800 }}>
                {currentQuestion + 1} of {aiQuestions.length}
              </div>
              <div style={{ flex: 1, height: 3, background: T.faint, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", background: T.accent, borderRadius: 2, width: `${((currentQuestion + 1) / aiQuestions.length) * 100}%`, transition: "width 0.3s ease" }} />
              </div>
            </div>

          <div style={{
            opacity: questionVisible ? 1 : 0,
            transform: questionVisible ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.2s ease, transform 0.2s ease",
          }}>
            <div style={{ fontSize: 11, color: T.accent, fontFamily: T.font, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>✨ Quick Question</div>
            <div style={{ fontSize: 17, color: T.text, fontFamily: T.body, fontWeight: 600, lineHeight: 1.5, marginBottom: 24 }}>
              {aiQuestions[currentQuestion].question}
            </div>

            {aiQuestions[currentQuestion].type === "yesno" && (
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => applyAnswer("yes")} style={{ flex: 1, background: T.accent, color: "#0f1410", border: "none", borderRadius: 10, padding: "14px", fontSize: 16, fontFamily: T.font, fontWeight: 800, cursor: "pointer" }}>Yes</button>
                <button onClick={() => applyAnswer("no")} style={{ flex: 1, background: T.faint, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px", fontSize: 16, fontFamily: T.font, fontWeight: 700, cursor: "pointer" }}>No</button>
              </div>
            )}

            {aiQuestions[currentQuestion].type === "choice" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {aiQuestions[currentQuestion].options.map((opt, i) => (
                  <button key={i} onClick={() => applyAnswer(opt)} style={{
                    background: T.faint, color: T.text, border: `1px solid ${T.border}`,
                    borderRadius: 10, padding: "14px 18px", fontSize: 15, fontFamily: T.body,
                    fontWeight: 600, cursor: "pointer", textAlign: "left",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={e => e.target.style.borderColor = T.accent}
                  onMouseLeave={e => e.target.style.borderColor = T.border}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {aiQuestions[currentQuestion].type === "number" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input
                  type="number"
                  placeholder="e.g. 8"
                  autoFocus
                  id="ai-number-input"
                  style={{ background: T.faint, border: `2px solid ${T.accentMid}`, borderRadius: 8, padding: "14px 16px", color: T.text, fontSize: 20, fontFamily: T.font, fontWeight: 700, outline: "none", textAlign: "center" }}
                  onKeyDown={(e) => { if (e.key === "Enter") { const v = e.target.value; if (v) applyAnswer(v); }}}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => applyAnswer(null)} style={{ flex: 1, background: T.faint, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px", fontSize: 13, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>Skip</button>
                  <button onClick={() => { const el = document.getElementById("ai-number-input"); if (el?.value) applyAnswer(el.value); }} style={{ flex: 2, background: T.accent, color: "#0f1410", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontFamily: T.font, fontWeight: 800, cursor: "pointer" }}>Confirm →</button>
                </div>
              </div>
            )}

            {aiQuestions[currentQuestion].type === "text" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input
                  type="text"
                  placeholder="Type your answer..."
                  autoFocus
                  id="ai-text-input"
                  style={{ background: T.faint, border: `2px solid ${T.accentMid}`, borderRadius: 8, padding: "14px 16px", color: T.text, fontSize: 15, fontFamily: T.body, outline: "none" }}
                  onKeyDown={(e) => { if (e.key === "Enter") { const v = e.target.value; if (v) applyAnswer(v); }}}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => applyAnswer(null)} style={{ flex: 1, background: T.faint, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px", fontSize: 13, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>Skip</button>
                  <button onClick={() => { const el = document.getElementById("ai-text-input"); if (el?.value) applyAnswer(el.value); }} style={{ flex: 2, background: T.accent, color: "#0f1410", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontFamily: T.font, fontWeight: 800, cursor: "pointer" }}>Confirm →</button>
                </div>
              </div>
            )}

            <button onClick={() => { setShowQuestionnaire(false); setAiQuestions([]); }} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, fontFamily: T.body, cursor: "pointer", textDecoration: "underline", marginTop: 16, display: "block", textAlign: "center", width: "100%" }}>
              Skip remaining questions
            </button>
          </div>
          </div>
        </div>
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
function OnboardingBanner({ ingredients, menuItems, onNavigate, tier }) {
  const isTracker = tier === "tracker";
  const hasIngredients = ingredients.length > 0;
  const hasMenuItems = menuItems.length > 0;
  const hasRecipes = menuItems.some(m => (m.ingredients || []).length > 0);

  // Tracker — only show a nudge if they haven't scanned anything yet
  if (isTracker) {
    if (hasIngredients) return null;
    return (
      <div style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 28 }}>📸</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: T.font, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 3 }}>Scan your first invoice to get started</div>
          <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>Take a photo of any supplier invoice — AI reads every ingredient and price automatically.</div>
        </div>
        <button onClick={() => onNavigate(1)} style={{ background: T.accent, color: "#0f1410", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontFamily: T.font, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
          Scan Invoice →
        </button>
      </div>
    );
  }

  // Full plan — only show the single next uncompleted step, disappears when all done
  const allDone = hasIngredients && hasMenuItems && hasRecipes;
  if (allDone) return null;

  const nextStep = !hasIngredients
    ? { title: "Scan your first invoice", desc: "Take a photo of any supplier invoice — AI reads every ingredient and price automatically", action: "Scan Invoice →", tab: 1 }
    : !hasMenuItems
    ? { title: "Scan your menu", desc: "Photo your printed menu and AI imports all your items and prices in seconds", action: "Scan Menu →", tab: 2 }
    : { title: "Add recipes to your menu items", desc: "Tell the app what goes into each dish so margins calculate automatically", action: "Add Recipes →", tab: 2 };

  return (
    <div style={{ background: T.card, border: `1px solid ${T.accentMid}`, borderRadius: 12, padding: "18px 24px", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: T.accentDim, border: `2px solid ${T.accentMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
        {!hasIngredients ? "📸" : !hasMenuItems ? "📷" : "🍽"}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontFamily: T.font, fontWeight: 700, color: T.text, marginBottom: 2 }}>{nextStep.title}</div>
        <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>{nextStep.desc}</div>
      </div>
      <button onClick={() => onNavigate(nextStep.tab)} style={{ background: T.accent, color: "#0f1410", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontFamily: T.font, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
        {nextStep.action}
      </button>
    </div>
  );
}

// ─── Legal Modals ─────────────────────────────────────────────────────────────
function TermsModal({ onClose }) {
  return (
    <Modal title="Terms of Service" onClose={onClose}>
      <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, lineHeight: 1.7, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>Last updated: March 2026 · Governing law: State of Connecticut</div>

        <div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>1. Acceptance of Terms</div>
          By creating an account or using KitchenIQ ("Service"), you agree to these Terms of Service. If you do not agree, do not use the Service. These terms are between you and Jacob Stevenson, operating as KitchenIQ ("we", "us", "our").
        </div>

        <div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>2. Description of Service</div>
          KitchenIQ is a SaaS platform that helps independent restaurant operators track ingredient costs, scan supplier invoices using AI, calculate menu margins, receive price change alerts, and get AI-powered recipe cost suggestions. The Service is provided on a subscription basis.
        </div>

        <div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>3. Subscriptions and Billing</div>
          Access to KitchenIQ requires a paid subscription at $89/month or $799/year. Subscriptions automatically renew until cancelled. You may cancel at any time from the Account tab inside the app or by contacting us at support@trykitcheniq.com. Cancellation takes effect at the end of your current billing period. No refunds are issued for partial billing periods. Pricing is subject to change with 30 days notice.
        </div>

        <div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>4. Your Data</div>
          You retain full ownership of all data you enter into KitchenIQ, including ingredient data, menu items, and invoice information. We do not sell your data to third parties. Invoice images uploaded for scanning are processed by our AI and are not stored permanently.
        </div>

        <div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>5. Acceptable Use</div>
          You agree to use the Service only for lawful purposes. You must be at least 18 years of age to create an account and use the Service. You may not attempt to reverse engineer, copy, resell, or misuse any part of the Service. You are responsible for maintaining the security of your account credentials.
        </div>

        <div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>6. Disclaimer of Warranties</div>
          The Service is provided "as is" without warranties of any kind. We do not guarantee that cost calculations, margin figures, or price alerts are error-free or suitable for any specific business decision. Always verify important financial decisions independently.
        </div>

        <div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>7. Limitation of Liability</div>
          To the maximum extent permitted by law, KitchenIQ shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service. Our total liability shall not exceed the amount you paid in the 3 months prior to the claim.
        </div>

        <div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>8. Termination</div>
          We reserve the right to suspend or terminate accounts that violate these terms. Upon termination, your access to the Service ends and your data may be deleted after 30 days.
        </div>

        <div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>9. Contact</div>
          For questions about these terms, contact us at support@trykitcheniq.com.
        </div>
      </div>
    </Modal>
  );
}

function PrivacyModal({ onClose }) {
  return (
    <Modal title="Privacy Policy" onClose={onClose}>
      <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, lineHeight: 1.7, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>Last updated: March 2026 · Governing law: State of Connecticut</div>

        <div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>1. Information We Collect</div>
          We collect only what is necessary to provide the Service. This includes your email address when you create an account, and payment information processed securely by Stripe (we never store your card details directly). We also store the ingredient and menu data you choose to enter into the platform.
        </div>

        <div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>2. Invoice Images</div>
          When you scan an invoice, the image is temporarily transmitted to Anthropic's API for AI processing to extract ingredient and pricing data. Images are not stored on our servers after processing. When you use the AI recipe suggestion feature, your dish name and ingredient list are also transmitted to Anthropic's API to generate recipe recommendations. We do not use your invoice or recipe data to train AI models.
        </div>

        <div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>3. How We Use Your Information</div>
          We use your information solely to provide and improve the Service — to authenticate your account, process your subscription, send price alert emails you've opted into, and display your restaurant data back to you. We do not use your data for advertising.
        </div>

        <div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>4. Third-Party Services</div>
          We use the following trusted third-party services to operate KitchenIQ: Supabase (database and authentication), Stripe (payment processing), Anthropic (AI invoice scanning), Resend (transactional email), and Vercel (hosting). Each of these has their own privacy policies governing how they handle data.
        </div>

        <div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>5. Data Security</div>
          Your data is stored securely using Supabase with row-level security — meaning your restaurant's data is only accessible by your account. Passwords are hashed and never stored in plain text. All data is transmitted over HTTPS.
        </div>

        <div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>6. Data Retention</div>
          We retain your data for as long as your account is active. If you cancel your subscription and request deletion, we will delete your data within 30 days. You may request an export of your data at any time via the CSV export feature.
        </div>

        <div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>7. Your Rights</div>
          You have the right to access, correct, or delete your personal data at any time. To make a request, contact us at support@trykitcheniq.com. We will respond within 30 days.
        </div>

        <div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>8. Changes to This Policy</div>
          We may update this Privacy Policy from time to time. We will notify you of significant changes via email. Continued use of the Service after changes constitutes acceptance of the updated policy.
        </div>

        <div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>9. Contact</div>
          For privacy-related questions or requests, contact us at support@trykitcheniq.com.
        </div>
      </div>
    </Modal>
  );
}

// ─── Legal Links Component ────────────────────────────────────────────────────
function LegalLinks() {
  const [show, setShow] = useState(null); // null | "terms" | "privacy"
  return (
    <>
      <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: T.muted, fontFamily: T.body }}>
        By using KitchenIQ you agree to our{" "}
        <button onClick={() => setShow("terms")} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontFamily: T.body, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Terms of Service</button>
        {" "}and{" "}
        <button onClick={() => setShow("privacy")} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontFamily: T.body, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Privacy Policy</button>
      </div>
      {show === "terms" && <TermsModal onClose={() => setShow(null)} />}
      {show === "privacy" && <PrivacyModal onClose={() => setShow(null)} />}
    </>
  );
}

// ─── Paywall Screen ───────────────────────────────────────────────────────────
function PaywallScreen({ session }) {
  const [coupon, setCoupon] = useState("");
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  const checkout = async (priceId) => {
    setLoading(priceId); setError(null);
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, userId: session.user.id, userEmail: session.user.email, couponCode: coupon.trim() || null }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      window.location.href = data.url;
    } catch (e) {
      setError(e.message);
      setLoading(null);
    }
  };

  const signOut = async () => await supabase.auth.signOut();

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <button onClick={signOut} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, fontFamily: T.body, cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
          ← Back to home
        </button>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: T.accentDim, border: `1px solid ${T.accentMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>⬡</div>
          <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 28, color: T.text }}>Kitchen<span style={{ color: T.accent }}>IQ</span></div>
          <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, marginTop: 6 }}>Restaurant cost intelligence</div>
        </div>

        {/* Tracker Tier */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "24px 28px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 16, color: T.text }}>Tracker</div>
              <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 3 }}>Basic price tracking — no margins</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 26, color: T.text }}>$25</div>
              <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>per month</div>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {["✓ Invoice scanning", "✓ Price spike alerts", "✓ Price history"].map(f => (
              <span key={f} style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>{f}</span>
            ))}
          </div>
          <button onClick={() => checkout("price_1TFT25BgJhkzALVkj60iZ33B")} disabled={!!loading}
            style={{ width: "100%", background: T.faint, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "11px 20px", fontSize: 13, fontFamily: T.font, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading === "price_1TFT25BgJhkzALVkj60iZ33B" ? "Redirecting..." : "Start Tracking — $25/month"}
          </button>
        </div>

        {/* Full Plan — Monthly */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "24px 28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 18, color: T.text }}>Full — Monthly</div>
                <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, marginTop: 4 }}>Everything included · Cancel anytime</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 32, color: T.text }}>$89</div>
                <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>per month</div>
              </div>
            </div>
            <button onClick={() => checkout(import.meta.env.VITE_STRIPE_PRICE_MONTHLY)} disabled={!!loading}
              style={{ width: "100%", background: T.faint, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "13px 20px", fontSize: 14, fontFamily: T.font, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading === import.meta.env.VITE_STRIPE_PRICE_MONTHLY ? "Redirecting..." : "Get Started Monthly"}
            </button>
          </div>

          {/* Full Plan — Yearly */}
          <div style={{ background: T.card, border: `2px solid ${T.accentMid}`, borderRadius: 14, padding: "28px 28px", position: "relative" }}>
            <div style={{ position: "absolute", top: -12, left: 24, background: T.accent, color: "#0f1410", borderRadius: 20, padding: "4px 14px", fontSize: 11, fontFamily: T.font, fontWeight: 800, letterSpacing: "0.05em" }}>BEST VALUE</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 18, color: T.text }}>Full — Yearly</div>
                <div style={{ fontSize: 13, color: T.accent, fontFamily: T.body, marginTop: 4 }}>Save $269 vs monthly</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 32, color: T.accent }}>$799</div>
                <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>per year</div>
              </div>
            </div>
            <button onClick={() => checkout(import.meta.env.VITE_STRIPE_PRICE_YEARLY)} disabled={!!loading}
              style={{ width: "100%", background: T.accent, border: "none", color: "#0f1410", borderRadius: 8, padding: "13px 20px", fontSize: 14, fontFamily: T.font, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading === import.meta.env.VITE_STRIPE_PRICE_YEARLY ? "Redirecting..." : "Get Started Yearly"}
            </button>
          </div>
        </div>

        {/* Feature comparison */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 14 }}>What's included</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "8px 16px", alignItems: "center" }}>
            <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, fontWeight: 600 }}>Feature</div>
            <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, fontWeight: 600, textAlign: "center" }}>Tracker</div>
            <div style={{ fontSize: 11, color: T.accent, fontFamily: T.body, fontWeight: 600, textAlign: "center" }}>Full</div>
            {[
              ["AI invoice scanning", true, true],
              ["Price history tracking", true, true],
              ["Price spike alerts (in-app)", true, true],
              ["Price spike email alerts", false, true],
              ["Menu margin calculations", false, true],
              ["Recipe costing", false, true],
              ["AI recipe suggestions", false, true],
              ["AI menu scanning", false, true],
              ["CSV export", false, true],
              ["Dashboard insights", false, true],
            ].map(([feat, tracker, full]) => (
              <>
                <div key={feat} style={{ fontSize: 13, color: T.text, fontFamily: T.body }}>{feat}</div>
                <div style={{ textAlign: "center", fontSize: 14 }}>{tracker ? <span style={{ color: T.accent }}>✓</span> : <span style={{ color: T.faint }}>—</span>}</div>
                <div style={{ textAlign: "center", fontSize: 14 }}>{full ? <span style={{ color: T.accent }}>✓</span> : <span style={{ color: T.faint }}>—</span>}</div>
              </>
            ))}
          </div>
        </div>

        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 10 }}>Beta tester coupon code</div>
          <input value={coupon} onChange={e => setCoupon(e.target.value)} placeholder="Enter your code..."
            style={{ width: "100%", background: T.faint, border: `1px solid ${T.border}`, borderRadius: 6, padding: "10px 14px", color: T.text, fontSize: 13, fontFamily: T.body, outline: "none", boxSizing: "border-box" }} />
          <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, marginTop: 8 }}>Beta testers enter your code above then select a plan — it will apply 100% off automatically</div>
        </div>

        {error && <div style={{ background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 8, padding: "12px 16px", fontSize: 13, color: T.warn, fontFamily: T.body, marginBottom: 16 }}>⚠ {error}</div>}
        <div style={{ textAlign: "center" }}>
          <button onClick={signOut} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, fontFamily: T.body, cursor: "pointer" }}>Sign out</button>
        </div>
        <LegalLinks />
      </div>
    </div>
  );
}

// ─── Tracker Upgrade Gate ─────────────────────────────────────────────────────
function TrackerUpgradeGate({ feature }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 20 }}>🔒</div>
      <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 22, color: T.text, marginBottom: 10 }}>{feature}</div>
      <div style={{ fontSize: 14, color: T.muted, fontFamily: T.body, lineHeight: 1.7, maxWidth: 420, marginBottom: 32 }}>
        {feature} is available on the Full KitchenIQ plan. Upgrade to unlock menu margin calculations, recipe costing, AI recipe suggestions, and everything else.
      </div>
      <div style={{ background: T.card, border: `2px solid ${T.accentMid}`, borderRadius: 14, padding: "24px 32px", width: "100%", maxWidth: 400, marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: T.accent, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 12 }}>Full Plan — Everything Included</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 14, color: T.muted, fontFamily: T.body }}>Monthly</div>
          <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 24, color: T.accent }}>$89<span style={{ fontSize: 13, color: T.muted, fontWeight: 400 }}>/mo</span></div>
        </div>
        {["Menu margin calculations", "Recipe costing", "AI recipe suggestions", "AI menu scanning", "Dashboard insights", "CSV export"].map(f => (
          <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ color: T.accent, fontSize: 13 }}>✓</span>
            <span style={{ fontSize: 13, color: T.text, fontFamily: T.body }}>{f}</span>
          </div>
        ))}
        <a href="/#/paywall" style={{ display: "block", marginTop: 20, background: T.accent, color: "#0f1410", borderRadius: 8, padding: "13px 20px", fontSize: 14, fontFamily: T.font, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
          Upgrade to Full Plan →
        </a>
      </div>
      <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>Questions? Email <span style={{ color: T.accent }}>support@trykitcheniq.com</span></div>
    </div>
  );
}

// ─── Demo Data ────────────────────────────────────────────────────────────────
const DEMO_INGREDIENTS = [
  // January invoice — baseline prices
  { id: "d1", name: "Bacon Sliced 18/14-16ct", supplier: "Sysco", date: "2026-01-08", price: 41.20, case_size: 15, case_unit: "lb", unit: "lb" },
  { id: "d2", name: "Eggs Large Grade A", supplier: "Mancini Foods", date: "2026-01-08", price: 38.40, case_size: 180, case_unit: "each", unit: "each" },
  { id: "d3", name: "Cheddar Cheese Shredded", supplier: "Sysco", date: "2026-01-08", price: 26.50, case_size: 4, case_unit: "lb", unit: "lb" },
  { id: "d4", name: "Ground Beef 80/20", supplier: "US Foods", date: "2026-01-08", price: 92.00, case_size: 30, case_unit: "lb", unit: "lb" },
  { id: "d5", name: "Chicken Breast Boneless", supplier: "US Foods", date: "2026-01-08", price: 51.00, case_size: 20, case_unit: "lb", unit: "lb" },
  { id: "d6", name: "Butter Unsalted", supplier: "Sysco", date: "2026-01-08", price: 36.00, case_size: 36, case_unit: "each", unit: "each" },
  // February invoice — price changes (eggs and bacon up significantly)
  { id: "d7", name: "Bacon Sliced 18/14-16ct", supplier: "Sysco", date: "2026-02-12", price: 47.80, case_size: 15, case_unit: "lb", unit: "lb" },
  { id: "d8", name: "Eggs Large Grade A", supplier: "Mancini Foods", date: "2026-02-12", price: 52.80, case_size: 180, case_unit: "each", unit: "each" },
  { id: "d9", name: "Cheddar Cheese Shredded", supplier: "Sysco", date: "2026-02-12", price: 24.80, case_size: 4, case_unit: "lb", unit: "lb" },
  { id: "d10", name: "Ground Beef 80/20", supplier: "US Foods", date: "2026-02-12", price: 98.50, case_size: 30, case_unit: "lb", unit: "lb" },
  { id: "d11", name: "Chicken Breast Boneless", supplier: "US Foods", date: "2026-02-12", price: 51.00, case_size: 20, case_unit: "lb", unit: "lb" },
  { id: "d12", name: "Butter Unsalted", supplier: "Sysco", date: "2026-02-12", price: 36.00, case_size: 36, case_unit: "each", unit: "each" },
];

const DEMO_MENU_ITEMS = [
  { id: "m1", name: "Bacon & Eggs Breakfast", sale_price: 12.99, ingredients: [{ ingredient_name: "Bacon Sliced 18/14-16ct", qty: 4, qty_unit: "oz" }, { ingredient_name: "Eggs Large Grade A", qty: 2, qty_unit: "each" }] },
  { id: "m2", name: "Classic Smash Burger", sale_price: 12.99, ingredients: [{ ingredient_name: "Ground Beef 80/20", qty: 6, qty_unit: "oz" }, { ingredient_name: "Cheddar Cheese Shredded", qty: 1.5, qty_unit: "oz" }] },
  { id: "m3", name: "Grilled Chicken Sandwich", sale_price: 11.99, ingredients: [{ ingredient_name: "Chicken Breast Boneless", qty: 5, qty_unit: "oz" }, { ingredient_name: "Butter Unsalted", qty: 1, qty_unit: "each" }] },
  { id: "m4", name: "Three Egg Omelette", sale_price: 10.99, ingredients: [{ ingredient_name: "Eggs Large Grade A", qty: 3, qty_unit: "each" }, { ingredient_name: "Cheddar Cheese Shredded", qty: 1.5, qty_unit: "oz" }, { ingredient_name: "Butter Unsalted", qty: 1, qty_unit: "each" }] },
  { id: "m5", name: "Egg & Cheese Sandwich", sale_price: 7.99, ingredients: [{ ingredient_name: "Eggs Large Grade A", qty: 2, qty_unit: "each" }, { ingredient_name: "Cheddar Cheese Shredded", qty: 1, qty_unit: "oz" }, { ingredient_name: "Butter Unsalted", qty: 1, qty_unit: "each" }] },
];

const DEMO_SCAN_ITEMS = [
  { name: "Bacon Sliced 18/14-16ct", price: 47.80, case_size: 15, case_unit: "lb" },
  { name: "Eggs Large Grade A", price: 52.80, case_size: 180, case_unit: "each" },
  { name: "Cheddar Cheese Shredded", price: 24.80, case_size: 4, case_unit: "lb" },
  { name: "Ground Beef 80/20", price: 98.50, case_size: 30, case_unit: "lb" },
  { name: "Chicken Breast Boneless", price: 51.00, case_size: 20, case_unit: "lb" },
  { name: "Butter Unsalted", price: 36.00, case_size: 36, case_unit: "each" },
];

// ─── Demo Invoice Scanner ─────────────────────────────────────────────────────
function DemoInvoiceScanner({ onClose, onComplete, isMobile }) {
  const [step, setStep] = useState("upload");
  const [visibleItems, setVisibleItems] = useState([]);

  const startScan = () => {
    setStep("scanning");
    setTimeout(() => {
      setStep("results");
      DEMO_SCAN_ITEMS.forEach((item, i) => {
        setTimeout(() => {
          setVisibleItems(prev => {
            const next = [...prev, item];
            // When all items loaded, fire onComplete automatically
            if (next.length === DEMO_SCAN_ITEMS.length) {
              onComplete && onComplete();
              // On mobile auto-close after a beat so they can see results
              if (isMobile) setTimeout(onClose, 1800);
            }
            return next;
          });
        }, i * 400);
      });
    }, 2200);
  };

  return (
    <Modal title="📸 AI Invoice Scanner" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: T.accent, fontFamily: T.body }}>
          ✨ AI reads your invoice and extracts ingredients, prices, and case sizes automatically
        </div>
        {step === "upload" && (
          <>
            <div style={{ border: `2px dashed ${T.accentMid}`, borderRadius: 10, padding: "28px 20px", textAlign: "center", background: T.accentDim, cursor: "pointer" }} onClick={startScan}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/240px-PNG_transparency_demonstration_1.png"
                alt="Sample invoice" style={{ maxWidth: "100%", maxHeight: 140, borderRadius: 6, objectFit: "contain", opacity: 0.7 }} />
              <div style={{ fontSize: 13, color: T.accent, fontFamily: T.font, fontWeight: 600, marginTop: 8 }}>Sample Sysco Invoice Loaded</div>
              <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, marginTop: 4 }}>Click Scan to extract ingredients</div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 6, padding: "10px 20px", fontSize: 13, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={startScan} style={{ background: `linear-gradient(135deg, #4eca6e22, #6e4eca22)`, color: T.accent, border: `2px solid ${T.accent}`, borderRadius: 6, padding: "10px 20px", fontSize: 13, fontFamily: T.font, fontWeight: 700, cursor: "pointer", animation: "tourPulse 2s ease-in-out infinite" }}>🔍 Scan Invoice</button>
            </div>
          </>
        )}
        {step === "scanning" && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16, animation: "spin 1s linear infinite" }}>⏳</div>
            <div style={{ fontSize: 15, color: T.accent, fontFamily: T.font, fontWeight: 700, marginBottom: 8 }}>AI is reading your invoice...</div>
            <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>Identifying ingredients, prices, and case sizes</div>
            <div style={{ marginTop: 20, height: 4, background: T.faint, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", background: T.accent, borderRadius: 2, animation: "progress 2.2s ease-in-out forwards" }} />
            </div>
          </div>
        )}
        {step === "results" && (
          <>
            <div style={{ fontSize: 11, color: T.accent, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body }}>✓ Found {DEMO_SCAN_ITEMS.length} items — AI extracted everything automatically</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
              {visibleItems.map((item, i) => (
                <div key={i} style={{ background: T.faint, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", animation: "fadeIn 0.3s ease" }}>
                  <div>
                    <div style={{ fontSize: 13, color: T.text, fontFamily: T.font, fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>{item.case_size} {item.case_unit} per case · unit cost: ${(item.price / item.case_size).toFixed(4)}/{item.case_unit}</div>
                  </div>
                  <div style={{ fontSize: 14, color: T.accent, fontFamily: T.font, fontWeight: 700 }}>${item.price.toFixed(2)}</div>
                </div>
              ))}
            </div>
            {visibleItems.length === DEMO_SCAN_ITEMS.length && (
              <div style={{ background: "#1a2a0a", border: `1px solid ${T.accentMid}`, borderRadius: 8, padding: "12px 16px" }}>
                <div style={{ fontSize: 13, color: T.accent, fontFamily: T.font, fontWeight: 700, marginBottom: 4 }}>⚡ 2 price changes detected from your last invoice</div>
                <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>🔴 Bacon Sliced: $41.20 → $47.80 (+16%) · 🔴 Eggs Large Grade A: $38.40 → $52.80 (+38%)</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              {isMobile ? (
                <button onClick={() => { onComplete && onComplete(); onClose(); }} style={{ background: T.accent, color: "#0f1410", border: "none", borderRadius: 6, padding: "12px 24px", fontSize: 14, fontFamily: T.font, fontWeight: 700, cursor: "pointer", width: "100%" }}>
                  ✓ Got it — close
                </button>
              ) : (
                <button onClick={() => { onComplete && onComplete(); onClose(); }} style={{ background: T.accent, color: "#0f1410", border: `2px solid ${T.accent}`, borderRadius: 6, padding: "10px 20px", fontSize: 13, fontFamily: T.font, fontWeight: 700, cursor: "pointer", animation: "tourPulse 2s ease-in-out infinite" }}>
                  ✓ This is what your real invoices would look like
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── Demo Screen ──────────────────────────────────────────────────────────────
function DemoScreen({ onSignUp, onLogin, onBack }) {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [showDemoScanner, setShowDemoScanner] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [flashCard, setFlashCard] = useState(null);
  const [liveAlertVisible, setLiveAlertVisible] = useState(false);
  const [chartOpacity, setChartOpacity] = useState(0);

  useEffect(() => {
    // Tour fires immediately — no scroll detection needed since demo is its own page
    setTimeout(() => setTourStep(1), 600);
    setTimeout(() => setChartOpacity(1), 400);
    const cards = ["ingredients", "menu", "margin", "alerts"];
    let cardIdx = 0;
    const cardFlash = setInterval(() => {
      setFlashCard(cards[cardIdx % cards.length]);
      cardIdx++;
      setTimeout(() => setFlashCard(null), 900);
    }, 3500);
    setTimeout(() => setLiveAlertVisible(true), 5000);
    setTimeout(() => setLiveAlertVisible(false), 9500);
    const interval = setInterval(() => setPulse(p => !p), 2000);
    return () => { clearInterval(interval); clearInterval(cardFlash); };
  }, []);

  const [tourStepDone, setTourStepDone] = useState(false);
  const [demoScanCompleted, setDemoScanCompleted] = useState(false);
  const [questionVisible, setQuestionVisible] = useState(true);

  const TOUR_STEPS = [
    { tab: 0, text: "👋 This is your Dashboard — margins and price alerts at a glance.", action: null },
    { tab: 1, text: "📸 Tap 'Scan Invoice' above — AI reads your invoice automatically. Try it!", action: "scan" },
    { tab: 3, text: "⚡ Every price change shows up here with exact dollar impact per dish.", action: null },
    { tab: 2, text: "🍽 Your real food cost % on every dish — updates automatically.", action: null },
  ];
  const currentTour = TOUR_STEPS[tourStep - 1];

  // Mark step done when user completes the required action
  useEffect(() => {
    if (!currentTour) return;
    // Step 1 (dashboard) and steps without actions are auto-complete
    if (!currentTour.action) setTourStepDone(true);
    else setTourStepDone(false);
  }, [tourStep]);

  // When demo scan is fully completed on step 2, mark it done
  useEffect(() => {
    if (tourStep === 2 && demoScanCompleted) setTourStepDone(true);
  }, [demoScanCompleted, tourStep]);

  const nextTour = () => {
    if (!tourStepDone) return;
    if (tourStep < TOUR_STEPS.length) {
      const next = tourStep + 1;
      setTourStep(next);
      setTab(TOUR_STEPS[next - 1]?.tab ?? tab);
      setTourStepDone(false);
    } else {
      setTourStep(0);
    }
  };

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: T.bg, fontFamily: T.body, color: T.text, boxSizing: "border-box", overflowX: "hidden" }}>

      {/* Demo header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, background: T.card }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {onBack && (
              <button onClick={onBack} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, fontFamily: T.body, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0 }}>← Back</button>
            )}
            <div style={{ width: 32, height: 32, borderRadius: 8, background: T.accentDim, border: `1px solid ${T.accentMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⬡</div>
            <span style={{ fontFamily: T.font, fontWeight: 800, fontSize: 18, color: T.text }}>Kitchen<span style={{ color: T.accent }}>IQ</span></span>
            <span style={{ fontSize: 11, background: T.warnDim, color: T.warn, border: `1px solid ${T.warn}44`, borderRadius: 4, padding: "2px 8px", fontFamily: T.font, fontWeight: 700, letterSpacing: "0.05em" }}>DEMO</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onLogin} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 6, padding: "8px 16px", fontSize: 13, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>Log In</button>
            <button onClick={onSignUp} style={{ background: T.accent, color: "#0f1410", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontFamily: T.font, fontWeight: 700, cursor: "pointer" }}>Connect My Restaurant →</button>
          </div>
        </div>
      </div>

      {/* Demo mode warning */}
      <div style={{ background: "#1a0a00", borderBottom: `1px solid ${T.warn}44`, padding: "8px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: T.warn, fontFamily: T.font, fontWeight: 700 }}>⚠ DEMO MODE</span>
          <span style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>— You are viewing sample data. Click "Connect My Restaurant" to get started with your real restaurant.</span>
        </div>
      </div>

      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "0 24px", display: "flex", background: T.card, overflowX: "auto" }}>
        {TABS.filter(t => t !== "Account" && t !== "Support").map((t, i) => {
          const alertCount = i === 3 ? getPriceAlerts(DEMO_INGREDIENTS).length : 0;
          return (
            <button key={i} onClick={() => setTab(i)} style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === i ? T.accent : "transparent"}`, color: tab === i ? T.accent : T.muted, padding: "14px 20px", fontSize: 13, fontFamily: T.font, fontWeight: 600, cursor: "pointer", transition: "color 0.15s", letterSpacing: "0.03em", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
              {ICONS[i]} {t}
              {alertCount > 0 && <span style={{ background: T.warn, color: "#fff", borderRadius: 10, fontSize: 10, padding: "2px 6px", fontFamily: T.font, fontWeight: 700, lineHeight: 1 }}>{alertCount}</span>}
            </button>
          );
        })}
      </div>

      <div style={{ width: "100%", padding: "24px 16px", paddingBottom: isMobile && tourStep > 0 ? 160 : 24, boxSizing: "border-box" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {tab === 0 && (
            <div>
              <style>{`
                @keyframes cardFlash { 0% { border-color: #1e2b1f; } 50% { border-color: #4eca6e; box-shadow: 0 0 16px #4eca6e33; } 100% { border-color: #1e2b1f; } }
                @keyframes slideIn { from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: translateY(0); } }
              `}</style>
              {liveAlertVisible && (
                <div style={{ background: "#1a0a00", border: `1px solid ${T.warn}`, borderRadius: 10, padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, animation: "slideIn 0.4s ease" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.warn, flexShrink: 0, boxShadow: `0 0 8px ${T.warn}` }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: T.warn, fontFamily: T.font, fontWeight: 700 }}>⚠ Price Alert — Eggs Large Grade A increased 38%</div>
                    <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 2 }}>$38.40 → $52.80 · Affects: Bacon & Eggs, Three Egg Omelette, Egg & Cheese Sandwich</div>
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>just now</div>
                </div>
              )}
              <Dashboard ingredients={DEMO_INGREDIENTS} menuItems={DEMO_MENU_ITEMS} onNavigate={setTab} flashCard={flashCard} chartOpacity={chartOpacity} />
            </div>
          )}
          {tab === 1 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body }}>{DEMO_INGREDIENTS.length} ingredients tracked</div>
                <button onClick={() => setShowDemoScanner(true)} style={{ background: `linear-gradient(135deg, #4eca6e22, #6e4eca22)`, border: `1px solid ${T.accentMid}`, color: T.accent, borderRadius: 6, padding: "10px 20px", fontSize: 13, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>📸 Scan Invoice</button>
              </div>
              {(() => {
                const grouped = {};
                DEMO_INGREDIENTS.forEach(ing => {
                  const key = ing.date || "Unknown Date";
                  if (!grouped[key]) grouped[key] = [];
                  grouped[key].push(ing);
                });
                const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    {sortedDates.map(date => (
                      <div key={date}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: T.accent, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, fontWeight: 600 }}>📄 {date}</div>
                          <div style={{ flex: 1, height: 1, background: T.border }} />
                          <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>{grouped[date].length} items · {grouped[date][0]?.supplier || ""}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {grouped[date].sort((a,b) => a.name.localeCompare(b.name)).map(ing => {
                            const uc = getUnitCost(ing);
                            return (
                              <div key={ing.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div>
                                  <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 600 }}>{ing.name}</div>
                                  <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 3 }}>{ing.case_size} {ing.case_unit} per case</div>
                                  {uc && <div style={{ fontSize: 11, color: T.accent, fontFamily: T.body, marginTop: 2 }}>Unit cost: ${uc.toFixed(4)}/{ing.case_unit}</div>}
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontSize: 16, color: T.accent, fontFamily: T.font, fontWeight: 700 }}>{fmt$2(ing.price)}</div>
                                  <div style={{ fontSize: 10, color: T.muted, fontFamily: T.body }}>per case</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
          {tab === 2 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body }}>{DEMO_MENU_ITEMS.length} menu items</div>
                <button onClick={onSignUp} style={{ background: T.accent, color: "#0f1410", border: "none", borderRadius: 6, padding: "10px 20px", fontSize: 13, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>📷 Scan Your Menu</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {DEMO_MENU_ITEMS.map(m => {
                  const { cost, profit, margin } = calcMenuStats(m, DEMO_INGREDIENTS);
                  const color = margin > 65 ? T.accent : margin > 50 ? "#e8c84a" : T.warn;
                  const isBad = margin < 50;
                  return (
                    <div key={m.id} style={{ background: T.card, border: `1px solid ${isBad ? T.warn + "66" : T.border}`, borderRadius: 10, padding: "16px 20px", boxShadow: isBad ? `0 0 16px ${T.warn}18` : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, color: T.text, fontFamily: T.font, fontWeight: 700 }}>{m.name}</div>
                          <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 4 }}>{(m.ingredients || []).map(i => `${i.qty}${i.qty_unit} ${i.ingredient_name}`).join(", ")}</div>
                          {isBad && <div style={{ fontSize: 11, color: T.warn, fontFamily: T.font, fontWeight: 700, marginTop: 6 }}>⚠ Below target — consider raising your price</div>}
                        </div>
                        <div style={{ textAlign: "right", marginLeft: 16 }}>
                          <div style={{ fontSize: 22, color, fontFamily: T.font, fontWeight: 800 }}>{fmtPct(margin)}</div>
                          {isBad && <div style={{ fontSize: 10, color: T.warn, fontFamily: T.body }}>needs attention</div>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 20, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.faint}` }}>
                        <span style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>Sale: <strong style={{ color: T.text }}>{fmt$2(m.sale_price)}</strong></span>
                        <span style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>Food Cost: <strong style={{ color: isBad ? T.warn : T.text }}>{fmt$2(cost)}</strong></span>
                        <span style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>Profit: <strong style={{ color: isBad ? T.warn : T.accent }}>{fmt$2(profit)}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {tab === 3 && (
            <div>
              <div style={{ background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 14, color: T.warn, fontFamily: T.font, fontWeight: 700, marginBottom: 4 }}>⚠ These price changes happened between January and February</div>
                <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>The owner of this sample restaurant never noticed. Their margins dropped silently for weeks.</div>
              </div>
              <AlertsView ingredients={DEMO_INGREDIENTS} />
              <div style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 10, padding: "16px 20px", marginTop: 16 }}>
                <div style={{ fontSize: 14, color: T.accent, fontFamily: T.font, fontWeight: 700, marginBottom: 4 }}>✓ KitchenIQ would have sent an email alert the moment you scanned that invoice</div>
                <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>Subject: "⚠ KitchenIQ Alert — Eggs Large price increased 81%" — caught automatically, no manual work.</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {tourStep > 0 && currentTour && (
        isMobile ? (
          // Mobile: compact bottom bar
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            background: "#0f1a10", borderTop: `2px solid ${T.accent}`,
            padding: "10px 14px 16px", zIndex: 200,
            boxShadow: "0 -4px 24px #000000aa",
          }}>
            <div style={{ height: 3, background: T.faint, borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", background: T.accent, borderRadius: 2, width: `${(tourStep / TOUR_STEPS.length) * 100}%`, transition: "width 0.3s ease" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ background: T.accent, color: "#0f1410", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontFamily: T.font, fontWeight: 800, whiteSpace: "nowrap" }}>{tourStep}/{TOUR_STEPS.length}</div>
              <div style={{ flex: 1, fontSize: 13, color: T.text, fontFamily: T.body, lineHeight: 1.4, fontWeight: 500, opacity: questionVisible ? 1 : 0, transition: "opacity 0.2s ease" }}>{currentTour.text}</div>
              <button onClick={nextTour} disabled={!tourStepDone} style={{
                background: tourStepDone ? T.accent : T.faint,
                color: tourStepDone ? "#0f1410" : T.muted,
                border: "none", borderRadius: 8, padding: "10px 14px",
                fontSize: 13, fontFamily: T.font, fontWeight: 800,
                cursor: tourStepDone ? "pointer" : "not-allowed", whiteSpace: "nowrap",
                flexShrink: 0,
              }}>
                {tourStep < TOUR_STEPS.length ? "Next →" : "Done ✓"}
              </button>
            </div>
            {currentTour.action && !tourStepDone && (
              <div style={{ fontSize: 11, color: T.accent, fontFamily: T.body, marginTop: 6, textAlign: "center" }}>☝️ Complete the action above first</div>
            )}
            <button onClick={() => setTourStep(0)} style={{ background: "none", border: "none", color: T.muted, fontSize: 11, fontFamily: T.body, cursor: "pointer", textDecoration: "underline", display: "block", textAlign: "center", width: "100%", marginTop: 4 }}>
              Skip
            </button>
          </div>
        ) : (
          // Desktop: right side panel
          <div style={{
            position: "fixed", top: "50%", right: 16, transform: "translateY(-50%)",
            background: "#0f1a10", border: `2px solid ${T.accent}`,
            borderRadius: 16, padding: "28px 22px", zIndex: 200,
            width: 240, boxShadow: "0 8px 40px #000000aa",
            animation: "tourPulse 2s ease-in-out infinite",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ background: T.accent, color: "#0f1410", borderRadius: 20, padding: "3px 12px", fontSize: 11, fontFamily: T.font, fontWeight: 800, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>STEP {tourStep} OF {TOUR_STEPS.length}</div>
            </div>
            <div style={{ height: 4, background: T.faint, borderRadius: 2, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ height: "100%", background: T.accent, borderRadius: 2, width: `${(tourStep / TOUR_STEPS.length) * 100}%`, transition: "width 0.3s ease" }} />
            </div>
            <div style={{ opacity: questionVisible ? 1 : 0, transform: questionVisible ? "translateY(0)" : "translateY(8px)", transition: "opacity 0.2s ease, transform 0.2s ease" }}>
              <div style={{ fontSize: 15, color: T.text, fontFamily: T.body, lineHeight: 1.7, marginBottom: 20, fontWeight: 500 }}>{currentTour.text}</div>
              {currentTour.action && !tourStepDone && (
                <div style={{ fontSize: 12, color: T.accent, fontFamily: T.body, marginBottom: 16, background: T.accentDim, borderRadius: 6, padding: "8px 12px", border: `1px solid ${T.accentMid}` }}>
                  ☝️ Complete the action above to continue
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={nextTour} disabled={!tourStepDone} style={{
                  background: tourStepDone ? T.accent : T.faint,
                  color: tourStepDone ? "#0f1410" : T.muted,
                  border: "none", borderRadius: 8,
                  padding: "12px 16px", fontSize: 14, fontFamily: T.font, fontWeight: 800,
                  cursor: tourStepDone ? "pointer" : "not-allowed", width: "100%",
                  transition: "all 0.2s",
                }}>
                  {tourStep < TOUR_STEPS.length ? "Next →" : "Got it ✓"}
                </button>
                <button onClick={() => setTourStep(0)} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, fontFamily: T.body, cursor: "pointer", textDecoration: "underline", textAlign: "center" }}>
                  Skip tour
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {showDemoScanner && <DemoInvoiceScanner onClose={() => setShowDemoScanner(false)} onComplete={() => setDemoScanCompleted(true)} isMobile={isMobile} />}

      <div style={{ background: T.card, borderTop: `1px solid ${T.border}`, padding: "24px", textAlign: "center" }}>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 14, color: T.muted, fontFamily: T.body }}>Ready to use this with your real restaurant?</span>
          <button onClick={onSignUp} style={{ background: T.accent, color: "#0f1410", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 14, fontFamily: T.font, fontWeight: 800, cursor: "pointer", boxShadow: `0 0 24px ${T.accent}44` }}>
            Get Started — $89/month →
          </button>
          {onBack && <button onClick={onBack} style={{ background: "transparent", color: T.muted, border: "none", fontSize: 13, fontFamily: T.body, cursor: "pointer", textDecoration: "underline" }}>← Back to home</button>}
        </div>
      </div>
    </div>
  );
}

// ─── Account View ─────────────────────────────────────────────────────────────
function AccountView({ session, profile, onProfileUpdate, onSignOut }) {
  const [restaurantName, setRestaurantName] = useState(profile?.restaurant_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(null); // null | "profile" | "email" | "password" | "cancel"
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const flash = (key) => { setSuccess(key); setTimeout(() => setSuccess(null), 3000); };

  const saveProfile = async () => {
    setSaving("profile"); setError(null);
    const { error } = await supabase.from("profiles").update({ restaurant_name: restaurantName, phone }).eq("id", session.user.id);
    setSaving(null);
    if (error) return setError(error.message);
    onProfileUpdate({ ...profile, restaurant_name: restaurantName, phone });
    flash("profile");
  };

  const saveEmail = async () => {
    if (!newEmail) return;
    setSaving("email"); setError(null);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setSaving(null);
    if (error) return setError(error.message);
    setNewEmail("");
    flash("email");
  };

  const savePassword = async () => {
    if (newPassword.length < 6) return setError("Password must be at least 6 characters.");
    if (newPassword !== confirmPassword) return setError("Passwords don't match.");
    setSaving("password"); setError(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(null);
    if (error) return setError(error.message);
    setNewPassword(""); setConfirmPassword("");
    flash("password");
  };

  const cancelSubscription = async () => {
    setSaving("cancel"); setError(null);
    try {
      const res = await fetch("/api/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      flash("cancel");
      setShowCancelConfirm(false);
    } catch (e) {
      setError(e.message);
    }
    setSaving(null);
  };

  const Section = ({ title, children }) => (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, fontWeight: 600 }}>{title}</div>
      {children}
    </div>
  );

  const SaveBtn = ({ id, label, loadingLabel, disabled }) => (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <Btn onClick={() => id === "profile" ? saveProfile() : id === "email" ? saveEmail() : savePassword()} disabled={saving === id || disabled}>
        {saving === id ? loadingLabel : success === id ? "✓ Saved" : label}
      </Btn>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 600 }}>

      {error && (
        <div style={{ background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 8, padding: "12px 16px", fontSize: 13, color: T.warn, fontFamily: T.body }}>⚠ {error}</div>
      )}

      {/* Restaurant Info */}
      <Section title="Restaurant Info">
        <Input label="Restaurant Name" value={restaurantName} onChange={setRestaurantName} placeholder="e.g. Jake's Restaurant" />
        <Input label="Phone Number" value={phone} onChange={setPhone} placeholder="e.g. (860) 555-0123" />
        <SaveBtn id="profile" label="Save Info" loadingLabel="Saving..." />
      </Section>

      {/* Account */}
      <Section title="Account">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: T.body }}>Current Email</div>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.body, background: T.faint, borderRadius: 6, padding: "10px 14px", border: `1px solid ${T.border}` }}>{session.user.email}</div>
        </div>
        <Input label="New Email Address" value={newEmail} onChange={setNewEmail} type="email" placeholder="new@restaurant.com" />
        <SaveBtn id="email" label="Update Email" loadingLabel="Updating..." disabled={!newEmail} />
        <div style={{ height: 1, background: T.border }} />
        <Input label="New Password" value={newPassword} onChange={setNewPassword} type="password" placeholder="At least 6 characters" />
        <Input label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="Repeat new password" />
        <SaveBtn id="password" label="Update Password" loadingLabel="Updating..." disabled={!newPassword || !confirmPassword} />
      </Section>

      {/* Subscription */}
      <Section title="Subscription">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700 }}>
              {profile?.is_subscribed ? "Active" : "Inactive"}
            </div>
            <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 3 }}>
              {profile?.is_subscribed ? "Your subscription is active and renewing automatically." : "No active subscription."}
            </div>
          </div>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: profile?.is_subscribed ? T.accent : T.warn, boxShadow: `0 0 8px ${profile?.is_subscribed ? T.accent : T.warn}` }} />
        </div>

        {profile?.is_subscribed && !showCancelConfirm && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn variant="danger" onClick={() => setShowCancelConfirm(true)}>Cancel Subscription</Btn>
          </div>
        )}

        {showCancelConfirm && (
          <div style={{ background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 14, color: T.warn, fontFamily: T.font, fontWeight: 700 }}>Are you sure you want to cancel?</div>
            <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>You'll keep access until the end of your current billing period. This cannot be undone.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setShowCancelConfirm(false)}>Keep Subscription</Btn>
              <Btn variant="danger" onClick={cancelSubscription} disabled={saving === "cancel"}>
                {saving === "cancel" ? "Cancelling..." : "Yes, Cancel"}
              </Btn>
            </div>
          </div>
        )}

        {success === "cancel" && (
          <div style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 8, padding: "12px 16px", fontSize: 13, color: T.accent, fontFamily: T.body }}>
            ✓ Subscription cancelled. You'll retain access until the end of your billing period.
          </div>
        )}

        <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, paddingTop: 4 }}>
          For billing questions email <span style={{ color: T.accent }}>support@trykitcheniq.com</span>
        </div>
      </Section>

      {/* Danger Zone */}
      <Section title="Session">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>Signed in as {session.user.email}</div>
          <Btn variant="ghost" onClick={onSignOut}>Sign Out</Btn>
        </div>
      </Section>

    </div>
  );
}

// ─── Support View ─────────────────────────────────────────────────────────────
function SupportView({ session }) {
  const [type, setType] = useState("bug");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const types = [
    { key: "bug", label: "🐛 Report a Bug", desc: "Something not working right? Tell Jake directly." },
    { key: "idea", label: "💡 Feature Idea", desc: "Got a suggestion that would make KitchenIQ better for your restaurant?" },
    { key: "testimonial", label: "⭐ Leave a Testimonial", desc: "Loving KitchenIQ? Share your experience — it helps more restaurants find us." },
  ];

  const placeholders = {
    bug: "Describe what happened, what you expected, and what device/browser you were using...",
    idea: "Describe the feature and how it would help your restaurant...",
    testimonial: "Tell us how KitchenIQ has helped your restaurant. We may feature your testimonial on our website!",
  };

  const subjects = {
    bug: "🐛 Bug Report",
    idea: "💡 Feature Idea",
    testimonial: "⭐ Testimonial",
  };

  const submit = async () => {
    if (!message.trim()) return setError("Please enter a message before sending.");
    setSending(true); setError(null);
    try {
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0f1410; color: #e8f0e9; padding: 32px; border-radius: 12px;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 22px; font-weight: 800;">Kitchen<span style="color: #4eca6e;">IQ</span></span>
            <span style="margin-left: 12px; font-size: 12px; color: #6b8a6e;">${subjects[type]}</span>
          </div>
          <div style="background: #161d17; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
            <p style="color: #e8f0e9; font-size: 15px; line-height: 1.7; margin: 0;">${message.replace(/\n/g, "<br/>")}</p>
          </div>
          <div style="color: #6b8a6e; font-size: 12px;">
            From: ${session.user.email} · Sent via KitchenIQ app
          </div>
        </div>
      `;
      const res = await fetch("/api/send-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "jake@trykitcheniq.com",
          subject: `${subjects[type]} from ${session.user.email}`,
          html,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setSent(true);
      setMessage("");
    } catch (e) {
      setError("Couldn't send your message. Try emailing jake@trykitcheniq.com directly.");
    }
    setSending(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 600 }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "24px 28px" }}>
        <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 18, color: T.text, marginBottom: 6 }}>👋 Talk to Jake directly</div>
        <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, lineHeight: 1.6 }}>
          KitchenIQ is built by one person who genuinely wants to make this the best tool for independent restaurants. Bug reports, feature ideas, and feedback go straight to his inbox — usually replied to same day.
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: T.accent, fontFamily: T.body }}>📧 jake@trykitcheniq.com</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {types.map(t => (
          <div key={t.key} onClick={() => { setType(t.key); setSent(false); setError(null); }} style={{
            background: type === t.key ? T.accentDim : T.card,
            border: `1px solid ${type === t.key ? T.accentMid : T.border}`,
            borderRadius: 10, padding: "14px 18px", cursor: "pointer",
            transition: "all 0.15s", display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: type === t.key ? T.accent : T.text, fontFamily: T.font, fontWeight: 700 }}>{t.label}</div>
              <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 2 }}>{t.desc}</div>
            </div>
            <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${type === t.key ? T.accent : T.border}`, background: type === t.key ? T.accent : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {type === t.key && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0f1410" }} />}
            </div>
          </div>
        ))}
      </div>

      {sent ? (
        <div style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 12, padding: "28px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
          <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 17, color: T.accent, marginBottom: 6 }}>Message sent!</div>
          <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, marginBottom: 16 }}>Jake will get back to you at {session.user.email}.</div>
          <Btn variant="ghost" onClick={() => setSent(false)}>Send Another</Btn>
        </div>
      ) : (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: T.body }}>Your Message</div>
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={placeholders[type]} rows={5} style={{
            background: T.faint, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: "12px 14px", color: T.text, fontSize: 13, fontFamily: T.body,
            outline: "none", resize: "vertical", width: "100%", boxSizing: "border-box", lineHeight: 1.6,
          }} />
          {error && <div style={{ background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 6, padding: "10px 14px", fontSize: 13, color: T.warn, fontFamily: T.body }}>⚠ {error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn onClick={submit} disabled={sending || !message.trim()}>{sending ? "Sending..." : "Send Message →"}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Set New Password Screen ──────────────────────────────────────────────────
function SetNewPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true); setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); return; }
    setDone(true);
    setTimeout(onDone, 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: T.accentDim, border: `1px solid ${T.accentMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>⬡</div>
          <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 28, color: T.text }}>Kitchen<span style={{ color: T.accent }}>IQ</span></div>
          <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, marginTop: 6 }}>Set your new password</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 32 }}>
          {done ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
              <div style={{ fontFamily: T.font, fontWeight: 700, fontSize: 18, color: T.accent, marginBottom: 8 }}>Password updated!</div>
              <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>Taking you to your dashboard...</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Input label="New Password" value={password} onChange={setPassword} type="password" placeholder="At least 6 characters" />
              <Input label="Confirm Password" value={confirm} onChange={setConfirm} type="password" placeholder="Repeat your new password" />
              {error && <div style={{ background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 6, padding: "10px 14px", fontSize: 13, color: T.warn, fontFamily: T.body }}>{error}</div>}
              <button onClick={submit} disabled={loading || !password || !confirm} style={{
                background: T.accent, color: "#0f1410", border: "none", borderRadius: 8,
                padding: "13px 20px", fontSize: 14, fontFamily: T.font, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, marginTop: 4,
              }}>{loading ? "Updating..." : "Set New Password"}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Demo Transition ──────────────────────────────────────────────────────────
function DemoTransition({ onComplete }) {
  const [phase, setPhase] = useState(0); // 0=scan 1=logo 2=text 3=fadeout

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 900);
    const t3 = setTimeout(() => setPhase(3), 1500);
    const t4 = setTimeout(() => onComplete(), 1900);
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#0a0f0a",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column",
      animation: phase === 3 ? "demoFadeOut 0.4s ease forwards" : "none",
      overflow: "hidden",
    }}>
      {/* Animated grid background */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `
          linear-gradient(rgba(78,202,110,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(78,202,110,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
        animation: "demoGridIn 0.6s ease forwards",
      }} />

      {/* Radial glow */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 600, height: 600,
        background: "radial-gradient(circle, #4eca6e18 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Scan line */}
      {phase < 1 && (
        <div style={{
          position: "absolute", left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${T.accent}, transparent)`,
          boxShadow: `0 0 20px ${T.accent}88`,
          animation: "demoScanLine 0.5s ease forwards",
        }} />
      )}

      {/* Pulsing rings */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 120, height: 120,
          borderRadius: "50%",
          border: `1px solid ${T.accent}44`,
          animation: `demoRingPulse 1.2s ease ${i * 0.25}s infinite`,
          pointerEvents: "none",
        }} />
      ))}

      {/* Logo */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
        position: "relative", zIndex: 2,
        animation: phase >= 1 ? "demoLogoIn 0.5s ease forwards" : "none",
        opacity: phase >= 1 ? 1 : 0,
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 18,
          background: T.accentDim, border: `2px solid ${T.accent}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36,
          boxShadow: `0 0 40px ${T.accent}55`,
        }}>⬡</div>
        <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 32, color: T.text }}>
          Kitchen<span style={{ color: T.accent }}>IQ</span>
        </div>
      </div>

      {/* Text */}
      <div style={{
        marginTop: 20, position: "relative", zIndex: 2,
        opacity: phase >= 2 ? 1 : 0,
        animation: phase >= 2 ? "demoTextIn 0.4s ease forwards" : "none",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 14, color: T.accent, fontFamily: T.body, letterSpacing: "0.15em", textTransform: "uppercase" }}>
          Loading live demo...
        </div>
        <div style={{ marginTop: 16, width: 200, height: 2, background: T.faint, borderRadius: 2, overflow: "hidden", margin: "16px auto 0" }}>
          <div style={{ height: "100%", background: T.accent, borderRadius: 2, animation: "progress 1.4s ease forwards" }} />
        </div>
      </div>
    </div>
  );
}

// ─── App Transition (reusable loading screen for major env changes) ───────────
function AppTransition({ message = "Loading...", submessage = "", onComplete, duration = 1800 }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 700);
    const t3 = setTimeout(() => setPhase(3), duration - 300);
    const t4 = onComplete ? setTimeout(onComplete, duration) : null;
    return () => [t1, t2, t3, t4].filter(Boolean).forEach(clearTimeout);
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#0a0f0a",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column",
      animation: phase === 3 ? "demoFadeOut 0.3s ease forwards" : "none",
      overflow: "hidden",
    }}>
      {/* Grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `
          linear-gradient(rgba(78,202,110,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(78,202,110,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
        opacity: phase >= 1 ? 1 : 0,
        transition: "opacity 0.4s ease",
      }} />

      {/* Radial glow */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 500, height: 500,
        background: "radial-gradient(circle, #4eca6e14 0%, transparent 70%)",
        pointerEvents: "none",
        opacity: phase >= 1 ? 1 : 0,
        transition: "opacity 0.6s ease",
      }} />

      {/* Rings */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 100, height: 100, borderRadius: "50%",
          border: `1px solid ${T.accent}33`,
          animation: phase >= 1 ? `demoRingPulse 1.4s ease ${i * 0.3}s infinite` : "none",
          pointerEvents: "none",
        }} />
      ))}

      {/* Logo */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
        position: "relative", zIndex: 2,
        opacity: phase >= 1 ? 1 : 0,
        transform: phase >= 1 ? "scale(1)" : "scale(0.85)",
        transition: "opacity 0.4s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: T.accentDim, border: `2px solid ${T.accent}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 30, boxShadow: `0 0 32px ${T.accent}44`,
        }}>⬡</div>
        <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 26, color: T.text }}>
          Kitchen<span style={{ color: T.accent }}>IQ</span>
        </div>
      </div>

      {/* Message */}
      <div style={{
        marginTop: 28, position: "relative", zIndex: 2, textAlign: "center",
        opacity: phase >= 2 ? 1 : 0,
        transform: phase >= 2 ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
      }}>
        <div style={{ fontSize: 15, color: T.accent, fontFamily: T.body, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {message}
        </div>
        {submessage && (
          <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, marginTop: 6 }}>{submessage}</div>
        )}
        <div style={{ marginTop: 20, width: 180, height: 2, background: T.faint, borderRadius: 2, overflow: "hidden", margin: "20px auto 0" }}>
          <div style={{ height: "100%", background: T.accent, borderRadius: 2, animation: `progress ${duration / 1000}s ease forwards` }} />
        </div>
      </div>
    </div>
  );
}


function useRoute() {
  const getRoute = () => {
    const hash = window.location.hash.replace("#", "") || "/";
    return hash;
  };
  const [route, setRoute] = useState(getRoute);
  useEffect(() => {
    const handler = () => setRoute(getRoute());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  const navigate = (path) => { window.location.hash = path; };
  return { route, navigate };
}

// ─── Landing Page ─────────────────────────────────────────────────────────────
function LandingPage({ onSignUp, onLogin, onDemo }) {
  const [visible, setVisible] = useState(false);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    setTimeout(() => setVisible(true), 80);
    const iv = setInterval(() => setPulse(p => !p), 2200);
    return () => clearInterval(iv);
  }, []);

  const fadeIn = (delay = 0) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(18px)",
    transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
  });

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: T.bg, fontFamily: T.body, color: T.text, boxSizing: "border-box", overflowX: "hidden" }}>

      {/* ── NAV ── */}
      <nav style={{ borderBottom: `1px solid ${T.border}`, background: "rgba(10,14,10,0.92)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: T.accentDim, border: `1.5px solid ${T.accentMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>⬡</div>
            <span style={{ fontFamily: T.font, fontWeight: 800, fontSize: 19, color: T.text, letterSpacing: "-0.01em" }}>Kitchen<span style={{ color: T.accent }}>IQ</span></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={onLogin} style={{ background: "transparent", border: "none", color: T.muted, fontSize: 14, fontFamily: T.body, fontWeight: 500, cursor: "pointer", padding: "8px 16px" }}>Log in</button>
            <button onClick={onDemo} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.text, borderRadius: 7, padding: "8px 18px", fontSize: 13, fontFamily: T.body, fontWeight: 500, cursor: "pointer" }}>Live demo</button>
            <button onClick={onSignUp} style={{ background: T.accent, color: "#0a0e0a", border: "none", borderRadius: 7, padding: "9px 20px", fontSize: 13, fontFamily: T.font, fontWeight: 700, cursor: "pointer" }}>Start free trial</button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div style={{ padding: "96px 32px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ maxWidth: 740, ...fadeIn(0) }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: T.warnDim, border: `1px solid ${T.warn}33`, borderRadius: 100, padding: "5px 14px", marginBottom: 28 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.warn, opacity: pulse ? 1 : 0.5, transition: "opacity 0.6s" }} />
            <span style={{ fontSize: 11, color: T.warn, fontFamily: T.body, fontWeight: 600, letterSpacing: "0.08em" }}>FOR INDEPENDENT RESTAURANTS</span>
          </div>
          <h1 style={{ fontFamily: T.font, fontWeight: 800, fontSize: "clamp(38px, 5vw, 64px)", lineHeight: 1.08, letterSpacing: "-0.03em", color: T.text, margin: "0 0 14px" }}>
            Your supplier raised prices.
          </h1>
          <h1 style={{ fontFamily: T.font, fontWeight: 800, fontSize: "clamp(38px, 5vw, 64px)", lineHeight: 1.08, letterSpacing: "-0.03em", color: T.warn, margin: "0 0 28px" }}>
            Did you notice?
          </h1>
          <p style={{ fontSize: "clamp(16px, 1.8vw, 19px)", color: T.muted, lineHeight: 1.75, maxWidth: 560, margin: "0 0 40px", fontWeight: 400 }}>
            KitchenIQ tracks every price change across all your suppliers automatically — so you always know your real food cost, on every dish, every day.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={onSignUp} style={{ background: T.accent, color: "#0a0e0a", border: "none", borderRadius: 8, padding: "16px 36px", fontSize: 15, fontFamily: T.font, fontWeight: 800, cursor: "pointer" }}>
              Start free trial →
            </button>
            <button onClick={onDemo} style={{ background: "transparent", color: T.muted, border: "none", fontSize: 14, fontFamily: T.body, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11 }}>▶</span> Watch demo
            </button>
          </div>
          <p style={{ fontSize: 12, color: T.muted, marginTop: 14, opacity: 0.7 }}>7-day free trial · No credit card commitment · Cancel anytime</p>
        </div>
      </div>

      {/* ── STATS ROW ── */}
      <div style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, background: T.card, ...fadeIn(100) }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
          {[
            { num: "$3,400+", label: "Average annual loss from untracked price changes" },
            { num: "5 min", label: "Setup time — scan your first invoice and you're live" },
            { num: "Any supplier", label: "Works with Sysco, US Foods, local vendors — all of them" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "32px 24px", borderRight: i < 2 ? `1px solid ${T.border}` : "none" }}>
              <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 28, color: T.accent, marginBottom: 6, letterSpacing: "-0.02em" }}>{s.num}</div>
              <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 32px", ...fadeIn(150) }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: T.accent, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 16, fontWeight: 600 }}>How it works</div>
            <h2 style={{ fontFamily: T.font, fontWeight: 800, fontSize: "clamp(24px, 3vw, 38px)", color: T.text, lineHeight: 1.15, letterSpacing: "-0.02em", margin: "0 0 20px" }}>
              From invoice to insight in seconds
            </h2>
            <p style={{ fontSize: 15, color: T.muted, lineHeight: 1.75, margin: "0 0 40px" }}>
              No spreadsheets. No manual entry. Just scan, and KitchenIQ handles the rest.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {[
                { n: "01", title: "Scan any invoice", desc: "Photo your supplier invoice — Sysco, US Foods, your local guys. AI reads every ingredient, price, and case size instantly." },
                { n: "02", title: "Get instant alerts", desc: "The moment a price changes, you're notified. See exactly which dishes are affected and by how much per plate." },
                { n: "03", title: "Know your real margins", desc: "See your actual food cost percentage on every dish and get a suggested price to protect your margins." },
              ].map(s => (
                <div key={s.n} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                  <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 11, color: T.accentMid, letterSpacing: "0.1em", paddingTop: 2, minWidth: 24, flexShrink: 0 }}>{s.n}</div>
                  <div>
                    <div style={{ fontSize: 15, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 4 }}>{s.title}</div>
                    <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual panel — mock alert card */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Live price alerts</div>
            {[
              { name: "Eggs Shell Large Grade AA", change: "+38%", old: "$23.86", new: "$32.98", warn: true },
              { name: "Bacon Sliced Applewood", change: "+16%", old: "$41.20", new: "$47.80", warn: true },
              { name: "Ground Beef 80/20", change: "+7%", old: "$92.00", new: "$98.50", warn: true },
              { name: "Cheddar Cheese Shredded", change: "-6%", old: "$26.50", new: "$24.80", warn: false },
            ].map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: T.faint, borderRadius: 10, padding: "14px 16px", border: `1px solid ${a.warn ? T.warn + "22" : T.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: T.text, fontFamily: T.font, fontWeight: 600, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>{a.old} → {a.new} per case</div>
                </div>
                <div style={{ fontSize: 13, fontFamily: T.font, fontWeight: 800, color: a.warn ? T.warn : T.accent, flexShrink: 0 }}>{a.change}</div>
              </div>
            ))}
            <div style={{ background: T.warnDim, border: `1px solid ${T.warn}33`, borderRadius: 8, padding: "12px 16px", marginTop: 4 }}>
              <div style={{ fontSize: 12, color: T.warn, fontFamily: T.body, lineHeight: 1.5 }}>⚠ Your Bacon & Eggs plate now costs <strong>$0.84 more</strong> per serving. Consider adjusting your menu price.</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SUPPLIERS ── */}
      <div style={{ background: T.card, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: "56px 32px", ...fadeIn(200) }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: T.accent, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 14, fontWeight: 600 }}>Works with every supplier</div>
              <h2 style={{ fontFamily: T.font, fontWeight: 800, fontSize: "clamp(22px, 2.5vw, 32px)", color: T.text, lineHeight: 1.2, margin: "0 0 14px", letterSpacing: "-0.02em" }}>
                Your diner doesn't use one supplier. Neither does KitchenIQ.
              </h2>
              <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.7, margin: 0 }}>
                Most food cost tools are locked to a single distributor. KitchenIQ works with every invoice from every supplier — giving you the full picture, not half of it.
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["Sysco", "US Foods", "Performance Food Group", "Restaurant Depot", "Your Bread Guy", "Your Egg Farmer", "Local Meat Supplier", "✓ Any Supplier"].map((s, i) => (
                <div key={i} style={{
                  fontSize: 12, fontFamily: T.body, fontWeight: i === 7 ? 700 : 400,
                  color: i === 7 ? T.accent : T.muted,
                  background: i === 7 ? T.accentDim : T.faint,
                  border: `1px solid ${i === 7 ? T.accentMid : T.border}`,
                  borderRadius: 6, padding: "7px 14px",
                }}>{s}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── TESTIMONIAL ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 32px", ...fadeIn(250) }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>
          <div>
            <div style={{ width: 3, height: 48, background: T.accent, borderRadius: 2, marginBottom: 24 }} />
            <blockquote style={{ fontFamily: T.body, fontSize: 18, color: T.text, lineHeight: 1.7, fontStyle: "italic", margin: "0 0 20px", fontWeight: 300 }}>
              "I had no idea my corned beef cost had changed. KitchenIQ caught it on the first scan — I would have never noticed otherwise."
            </blockquote>
            <div style={{ fontSize: 13, color: T.accent, fontFamily: T.font, fontWeight: 700 }}>Owner, Jake's Restaurant</div>
            <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 2 }}>North Stonington, CT</div>
          </div>

          {/* Pain points right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              { title: "Prices change every delivery", desc: "Sysco, US Foods, local vendors — shifts happen constantly and quietly." },
              { title: "You're estimating your margins", desc: "Most owners guess food cost by feel. The real number is almost always worse." },
              { title: "Supplier tools show half the picture", desc: "Any tool tied to one distributor is blind to everything else you buy." },
            ].map(p => (
              <div key={p.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.warn, marginTop: 6, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 3 }}>{p.title}</div>
                  <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, fontFamily: T.body }}>{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BOTTOM CTA ── */}
      <div style={{ background: T.card, borderTop: `1px solid ${T.border}`, padding: "80px 32px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: T.font, fontWeight: 800, fontSize: "clamp(24px, 3.5vw, 40px)", color: T.text, lineHeight: 1.15, letterSpacing: "-0.02em", margin: "0 0 16px" }}>
            Most restaurants lose more in a month than KitchenIQ costs in a year.
          </h2>
          <p style={{ fontSize: 15, color: T.muted, lineHeight: 1.7, margin: "0 0 10px" }}>
            One unnoticed price spike on a high-volume ingredient can cost $200–$400 in a single month. KitchenIQ catches it automatically.
          </p>
          <p style={{ fontSize: 13, color: T.muted, margin: "0 0 36px", opacity: 0.7 }}>$89/month · $799/year · Cancel anytime</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onSignUp} style={{ background: T.accent, color: "#0a0e0a", border: "none", borderRadius: 8, padding: "17px 44px", fontSize: 16, fontFamily: T.font, fontWeight: 800, cursor: "pointer" }}>
              Start free trial →
            </button>
            <button onClick={onDemo} style={{ background: "transparent", color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: "17px 32px", fontSize: 15, fontFamily: T.body, fontWeight: 500, cursor: "pointer" }}>
              ▶ Try demo first
            </button>
          </div>
          <p style={{ fontSize: 12, color: T.muted, marginTop: 14, opacity: 0.6 }}>Set up in under 10 minutes. No spreadsheets. No manual entry.</p>
          <div style={{ marginTop: 32, display: "flex", justifyContent: "center" }}>
            <LegalLinks />
          </div>
        </div>
      </div>

    </div>
  );
}
// ─── Onboarding Wizard ────────────────────────────────────────────────────────
function OnboardingWizard({ session, ingredients, setIngredients, menuItems, setMenuItems, onComplete, tier }) {
  const isTracker = tier === "tracker";
  const [step, setStep] = useState(0);
  // steps: 0=welcome 1=scan1 2=scan2(optional) 3=dish 4=result
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Dish state
  const [dishName, setDishName] = useState("");
  const [dishPrice, setDishPrice] = useState("");
  const [dishIngredients, setDishIngredients] = useState([{ ingredient_name: "", qty: "", qty_unit: "oz" }]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Scan state — reuse InvoiceScanner inline
  const [scanImage, setScanImage] = useState(null);
  const [scanImageBase64, setScanImageBase64] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [scanDone, setScanDone] = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  // Reset scan state for a fresh scan
  const resetScan = () => { setScanImage(null); setScanImageBase64(null); setScanResults(null); setScanError(null); setScanning(false); setScanDone(false); };

  const handleScanFile = (file) => {
    if (!file) return;
    setScanResults(null); setScanError(null);
    setScanImage(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = (e) => setScanImageBase64(e.target.result.split(",")[1]);
    reader.readAsDataURL(file);
  };

  const removeFromScanResults = (i) => setScanResults(prev => prev.filter((_, idx) => idx !== i));

  const runScan = async () => {
    if (!scanImageBase64) return;
    setScanning(true); setScanError(null);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-opus-4-5", max_tokens: 2048,
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: scanImageBase64 } },
            { type: "text", text: `You are a restaurant food cost calculator. Extract only FOOD and BEVERAGE ingredients from this supplier invoice.

STRICT RULES — skip these entirely, do not include them:
- Fuel surcharges, delivery fees, service charges, environmental fees
- Cleaning supplies (soap, bleach, sanitizer, disinfectant)  
- Paper products (napkins, towels, bags, boxes, containers)
- Janitorial supplies (mops, brooms, dispensers, gloves)
- Any non-food, non-beverage item
- Line items with $0 price or that are clearly fees/adjustments

Only include: meats, seafood, produce, dairy, eggs, bread/bakery, dry goods, oils, sauces, beverages, and other actual food ingredients.

Return ONLY a raw JSON array. For each food item: name (noun-first format, no SKUs), price (unit price NOT extended total), case_size, case_unit (lb/oz/each/pack/bag), unit (same as case_unit), supplier (from header), date (YYYY-MM-DD, use ${today()} if missing).

Example: [{"name":"Bacon Sliced","price":42.50,"case_size":15,"case_unit":"lb","unit":"lb","supplier":"Sysco","date":"${today()}"}]` }
          ]}]
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      let text = data.content[0].text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("No food items found");
      setScanResults(parsed.map(r => normalizeIngredient(r)));
    } catch (e) {
      setScanError("Couldn't read that invoice. Try a clearer photo with good lighting.");
    }
    setScanning(false);
  };

  const confirmScan = async () => {
    if (!scanResults) return;
    setSaving(true);
    const rows = scanResults.map(r => ({ ...r, price: Number(r.price), case_size: r.case_size ? Number(r.case_size) : null, user_id: session.user.id }));
    const { data, error } = await supabase.from("ingredients").insert(rows).select();
    if (!error) setIngredients(prev => [...prev, ...data]);
    setSaving(false);
    setScanDone(true);
  };

  // Unique ingredients from everything scanned so far
  const uniqueIngredients = Object.values(
    ingredients.reduce((acc, ing) => {
      const key = ing.name.toLowerCase();
      if (!acc[key] || new Date(ing.date) > new Date(acc[key].date)) acc[key] = ing;
      return acc;
    }, {})
  ).sort((a, b) => a.name.localeCompare(b.name));

  const updateDishRow = (i, field, val) => setDishIngredients(prev => {
    const updated = prev.map((row, idx) => {
      if (idx !== i) return row;
      const newRow = { ...row, [field]: val };
      if (field === "ingredient_name") {
        const match = uniqueIngredients.find(ing => ing.name === val);
        if (match) newRow.qty_unit = match.case_unit || match.unit || "oz";
      }
      return newRow;
    });
    return updated;
  });
  const removeDishRow = (i) => setDishIngredients(prev => prev.filter((_, idx) => idx !== i));
  const addDishRow = () => setDishIngredients(prev => [...prev, { ingredient_name: "", qty: "", qty_unit: "oz" }]);

  const aiSuggest = async () => {
    if (!dishName || uniqueIngredients.length === 0) return;
    setAiLoading(true); setAiError(null);
    try {
      const ingredientList = uniqueIngredients.map(i => {
        const u = i.case_unit || i.unit || "oz";
        return `${i.name} (recipe unit: "${u}")`;
      }).join("\n");
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-opus-4-5", max_tokens: 512,
          messages: [{ role: "user", content: `Menu item: "${dishName}"\nIngredients (units are normalized — each = 1 piece/egg/slice):\n${ingredientList}\n\nIf this is not real food, return {"not_food":true,"recipe":[]}.\nOtherwise return ONLY raw JSON: {"not_food":false,"recipe":[{"ingredient_name":"EXACT name","qty":2,"qty_unit":"each"}]}\nOnly use ingredients from the list. Realistic per-serving quantities. NEVER use fractional each values — if unit is "each", use whole numbers only (1, 2, 3...). Max 5 ingredients.` }]
        })
      });
      const data = await response.json();
      let text = data.content[0].text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const parsed = JSON.parse(text);
      if (parsed.not_food) { setAiError(`"${dishName}" doesn't look like a menu item.`); }
      else if (parsed.recipe?.length > 0) {
        const matched = parsed.recipe.map(r => {
          const match = uniqueIngredients.find(i => i.name.toLowerCase() === r.ingredient_name.toLowerCase());
          return match ? { ingredient_name: match.name, qty: String(r.qty), qty_unit: r.qty_unit } : null;
        }).filter(Boolean);
        if (matched.length > 0) setDishIngredients(matched);
      }
    } catch (e) { /* silently fail */ }
    setAiLoading(false);
  };

  const dishCost = () => dishIngredients.reduce((total, row) => {
    const ing = ingredients.find(i => i.name.toLowerCase() === row.ingredient_name?.toLowerCase());
    if (!ing || !row.qty) return total;
    const uc = getUnitCost(ing);
    if (!uc) return total;
    return total + uc * convertUnits(Number(row.qty), row.qty_unit, ing.case_unit);
  }, 0);

  const saveDish = async () => {
    if (!dishName || !dishPrice) return;
    setSaving(true);
    const ings = dishIngredients.filter(r => r.ingredient_name && r.qty).map(r => ({ ingredient_name: r.ingredient_name, qty: parseFloat(r.qty), qty_unit: r.qty_unit }));
    const { data, error } = await supabase.from("menu_items").insert([{ name: dishName, sale_price: parseFloat(dishPrice), ingredients: ings, user_id: session.user.id }]).select();
    if (!error && data?.[0]) setMenuItems(prev => [...prev, data[0]]);
    await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", session.user.id);
    setSaving(false);
    setStep(4);
  };

  const cost = dishCost();
  const sale = parseFloat(dishPrice) || 0;
  const margin = sale > 0 ? ((sale - cost) / sale * 100) : 0;
  const profit = sale - cost;
  const marginColor = margin > 65 ? T.accent : margin > 50 ? "#e8c84a" : T.warn;
  const isBad = margin < 50 && cost > 0;
  const suggestedPrice = isBad && cost > 0 ? cost / (1 - 0.65) : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a0f0a", zIndex: 500, overflowY: "auto", opacity: visible ? 1 : 0, transition: "opacity 0.5s ease" }}>
      <div style={{ position: "fixed", inset: 0, backgroundImage: `linear-gradient(rgba(78,202,110,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(78,202,110,0.03) 1px, transparent 1px)`, backgroundSize: "40px 40px", pointerEvents: "none" }} />

      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ width: "100%", maxWidth: 540, position: "relative", zIndex: 1 }}>

          {/* Step 0 — Welcome */}
          {step === 0 && (
            <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease" }}>
              <div style={{ width: 80, height: 80, borderRadius: 20, background: T.accentDim, border: `2px solid ${T.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, margin: "0 auto 24px", boxShadow: `0 0 40px ${T.accent}44` }}>⬡</div>
              <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 30, color: T.text, marginBottom: 12 }}>Welcome to KitchenIQ!</div>
              {isTracker ? (
                <>
                  <div style={{ fontSize: 16, color: T.muted, fontFamily: T.body, lineHeight: 1.7, marginBottom: 12, maxWidth: 420, margin: "0 auto 12px" }}>
                    You're on the <strong style={{ color: T.accent }}>Tracker plan</strong> — let's get your ingredients loaded so KitchenIQ can start catching price changes automatically.
                  </div>
                  <div style={{ fontSize: 15, color: T.text, fontFamily: T.body, lineHeight: 1.6, marginBottom: 40, maxWidth: 440, margin: "0 auto 40px" }}>
                    Scan your supplier invoices and we'll track every price from here on out. The moment something spikes you'll see it right in the app.
                  </div>
                  <div style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 12, padding: "14px 20px", maxWidth: 380, margin: "0 auto 32px", textAlign: "left" }}>
                    <div style={{ fontSize: 13, color: T.accent, fontFamily: T.font, fontWeight: 700, marginBottom: 8 }}>What happens after setup:</div>
                    {["📸 Scan any invoice from any supplier", "⚡ See price changes the moment they happen", "📊 Full price history per ingredient", "🔒 Upgrade anytime to unlock margin calculations"].map(f => (
                      <div key={f} style={{ fontSize: 13, color: T.muted, fontFamily: T.body, marginBottom: 6 }}>{f}</div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 16, color: T.muted, fontFamily: T.body, lineHeight: 1.7, marginBottom: 12, maxWidth: 420, margin: "0 auto 12px" }}>
                    Let's get you your first real food cost insight in under 5 minutes.
                  </div>
                  <div style={{ fontSize: 15, color: T.text, fontFamily: T.body, lineHeight: 1.6, marginBottom: 40, maxWidth: 440, margin: "0 auto 40px" }}>
                    First we'll scan one of your supplier invoices so KitchenIQ knows what ingredients you actually use. Then we'll calculate the real cost of your top dish.
                  </div>
                </>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                <button onClick={() => setStep(1)} style={{ background: T.accent, color: "#0f1410", border: "none", borderRadius: 10, padding: "16px 48px", fontSize: 17, fontFamily: T.font, fontWeight: 800, cursor: "pointer", boxShadow: `0 0 32px ${T.accent}55` }}>
                  {isTracker ? "Let's Go — Scan My First Invoice →" : "Let's Go — Scan My First Invoice →"}
                </button>
                <button onClick={onComplete} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, fontFamily: T.body, cursor: "pointer", textDecoration: "underline" }}>
                  Skip setup — take me to the dashboard
                </button>
              </div>
            </div>
          )}

          {/* Steps 1 & 2 — Invoice scanning */}
          {(step === 1 || step === 2) && (
            <div style={{ animation: "fadeIn 0.4s ease" }}>
              {/* Progress */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
                {(isTracker
                  ? ["Scan Invoice", "Scan More?", "All Set!"]
                  : ["Scan Invoice", "Scan More?", "Your Top Dish", "Results"]
                ).map((label, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flex: i < (isTracker ? 2 : 3) ? 1 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: i < step ? T.accent : i === step - 1 ? T.accent : T.faint, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontFamily: T.font, fontWeight: 800, color: i <= step - 1 ? "#0f1410" : T.muted, flexShrink: 0 }}>{i < step - 1 ? "✓" : i + 1}</div>
                      <div style={{ fontSize: 10, color: i === step - 1 ? T.accent : T.muted, fontFamily: T.body, whiteSpace: "nowrap" }}>{label}</div>
                    </div>
                    {i < (isTracker ? 2 : 3) && <div style={{ flex: 1, height: 1, background: i < step - 1 ? T.accent : T.faint }} />}
                  </div>
                ))}
              </div>

              {step === 1 && scanDone && (
                <div style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 10, padding: "20px 24px" }}>
                  <div style={{ fontSize: 16, color: T.accent, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>✓ Invoice imported!</div>
                  <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, marginBottom: 20 }}>{ingredients.length} ingredients saved. Ready for the next step.</div>
                  <button onClick={() => { setStep(2); resetScan(); }} style={{ background: T.accent, color: "#0f1410", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 14, fontFamily: T.font, fontWeight: 800, cursor: "pointer" }}>Next →</button>
                </div>
              )}

              {step === 1 && !scanDone && (
                <>
                  <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 24, color: T.text, marginBottom: 8 }}>Scan your first supplier invoice</div>
                  <div style={{ fontSize: 14, color: T.muted, fontFamily: T.body, lineHeight: 1.6, marginBottom: 24 }}>Take a photo of any supplier invoice — Sysco, US Foods, your bread guy, anyone. AI will extract every ingredient and price automatically.</div>

                  {!scanResults ? (
                    <>
                      <div onClick={() => document.getElementById("onboard-upload").click()} style={{ border: `2px dashed ${scanImage ? T.accentMid : T.border}`, borderRadius: 12, padding: "32px 20px", textAlign: "center", cursor: "pointer", background: scanImage ? T.accentDim : T.faint, marginBottom: 16 }}>
                        {scanImage
                          ? <img src={scanImage} alt="Invoice" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 8, objectFit: "contain" }} />
                          : <>
                              <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                              <div style={{ fontSize: 15, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 6 }}>Tap to upload invoice photo</div>
                              <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>Works with any supplier — JPG or PNG</div>
                            </>}
                        <input id="onboard-upload" type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleScanFile(e.target.files[0])} />
                      </div>
                      {scanError && <div style={{ background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: T.warn, fontFamily: T.body, marginBottom: 12 }}>⚠ {scanError}</div>}
                      {scanning && (
                        <div style={{ textAlign: "center", padding: "20px 0" }}>
                          <div style={{ fontSize: 13, color: T.accent, fontFamily: T.body, marginBottom: 12 }}>⏳ AI is reading your invoice...</div>
                          <div style={{ height: 4, background: T.faint, borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", background: T.accent, borderRadius: 2, animation: "progress 3s ease forwards" }} />
                          </div>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={runScan} disabled={!scanImageBase64 || scanning} style={{ flex: 1, background: scanImageBase64 && !scanning ? T.accent : T.faint, color: scanImageBase64 && !scanning ? "#0f1410" : T.muted, border: "none", borderRadius: 8, padding: "14px", fontSize: 14, fontFamily: T.font, fontWeight: 800, cursor: scanImageBase64 && !scanning ? "pointer" : "not-allowed" }}>
                          {scanning ? "Scanning..." : "🔍 Scan Invoice"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 10, padding: "12px 16px", marginBottom: 8, fontSize: 13, color: T.accent, fontFamily: T.font, fontWeight: 700 }}>
                        ✓ Found {scanResults.length} food items — edit name/price or tap × to remove
                      </div>
                      <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginBottom: 10 }}>Tap any name or price to correct it before importing.</div>
                      <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                        {scanResults.map((r, i) => (
                          <div key={i} style={{ background: T.faint, borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                            <input value={r.name} onChange={e => setScanResults(prev => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, padding: "5px 8px", color: T.text, fontSize: 12, fontFamily: T.body, outline: "none" }} />
                            <input value={r.price} onChange={e => setScanResults(prev => prev.map((x, idx) => idx === i ? { ...x, price: e.target.value } : x))} style={{ width: 64, background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, padding: "5px 8px", color: T.accent, fontSize: 12, fontFamily: T.body, outline: "none" }} />
                            <button onClick={() => removeFromScanResults(i)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 18, padding: "0 2px", flexShrink: 0, lineHeight: 1 }}>×</button>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={resetScan} style={{ background: "none", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 8, padding: "12px 16px", fontSize: 13, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>Rescan</button>
                        <button onClick={confirmScan} disabled={saving || scanResults.length === 0} style={{ flex: 1, background: T.accent, color: "#0f1410", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontFamily: T.font, fontWeight: 800, cursor: "pointer" }}>
                          {saving ? "Saving..." : `✓ Import ${scanResults.length} Ingredients`}
                        </button>
                      </div>
                    </>
                  )}

                </>
              )}

              {step === 2 && (
                <>
                  <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 24, color: T.text, marginBottom: 8 }}>Got more invoices?</div>
                  <div style={{ fontSize: 14, color: T.muted, fontFamily: T.body, lineHeight: 1.6, marginBottom: 8 }}>
                    You scanned <strong style={{ color: T.text }}>{ingredients.length} ingredients</strong> so far. If your restaurant uses multiple suppliers (bread, meat, dairy), scan another invoice now for better recipe suggestions.
                  </div>
                  <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, marginBottom: 24 }}>You can always scan more invoices later from the Ingredients tab.</div>

                  {!scanResults ? (
                    <>
                      <div onClick={() => document.getElementById("onboard-upload2").click()} style={{ border: `2px dashed ${scanImage ? T.accentMid : T.border}`, borderRadius: 12, padding: "24px 20px", textAlign: "center", cursor: "pointer", background: scanImage ? T.accentDim : T.faint, marginBottom: 16 }}>
                        {scanImage
                          ? <img src={scanImage} alt="Invoice" style={{ maxWidth: "100%", maxHeight: 140, borderRadius: 8, objectFit: "contain" }} />
                          : <>
                              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                              <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 4 }}>Tap to upload another invoice</div>
                              <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>Bread supplier, meat supplier, dairy — any invoice</div>
                            </>}
                        <input id="onboard-upload2" type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleScanFile(e.target.files[0])} />
                      </div>
                      {scanning && <div style={{ textAlign: "center", padding: "16px 0", fontSize: 13, color: T.accent, fontFamily: T.body }}>⏳ AI is reading your invoice...</div>}
                      {scanError && <div style={{ background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: T.warn, fontFamily: T.body, marginBottom: 12 }}>⚠ {scanError}</div>}
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => setStep(isTracker ? "tracker_done" : 3)} style={{ flex: 1, background: "none", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 8, padding: "12px", fontSize: 13, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>{isTracker ? "Skip — I'm Done →" : "Skip — Set Up My Dish →"}</button>
                        {scanImage && <button onClick={runScan} disabled={scanning} style={{ flex: 1, background: T.accent, color: "#0f1410", border: "none", borderRadius: 8, padding: "12px", fontSize: 13, fontFamily: T.font, fontWeight: 800, cursor: "pointer" }}>🔍 Scan</button>}
                      </div>
                    </>
                  ) : scanDone ? (
                    <div style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ fontSize: 14, color: T.accent, fontFamily: T.font, fontWeight: 700 }}>✓ Imported! Total: {ingredients.length} ingredients</div>
                      <button onClick={() => setStep(isTracker ? "tracker_done" : 3)} style={{ background: T.accent, color: "#0f1410", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontFamily: T.font, fontWeight: 800, cursor: "pointer" }}>Next →</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 10, padding: "12px 16px", marginBottom: 8, fontSize: 13, color: T.accent, fontFamily: T.font, fontWeight: 700 }}>✓ Found {scanResults.length} more food items — edit or remove before importing</div>
                      <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                        {scanResults.map((r, i) => (
                          <div key={i} style={{ background: T.faint, borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                            <input value={r.name} onChange={e => setScanResults(prev => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, padding: "5px 8px", color: T.text, fontSize: 12, fontFamily: T.body, outline: "none" }} />
                            <input value={r.price} onChange={e => setScanResults(prev => prev.map((x, idx) => idx === i ? { ...x, price: e.target.value } : x))} style={{ width: 64, background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, padding: "5px 8px", color: T.accent, fontSize: 12, fontFamily: T.body, outline: "none" }} />
                            <button onClick={() => removeFromScanResults(i)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 18, padding: "0 2px", flexShrink: 0, lineHeight: 1 }}>×</button>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={resetScan} style={{ background: "none", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 8, padding: "12px 16px", fontSize: 13, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>Rescan</button>
                        <button onClick={confirmScan} disabled={saving || scanResults.length === 0} style={{ flex: 1, background: T.accent, color: "#0f1410", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontFamily: T.font, fontWeight: 800, cursor: "pointer" }}>{saving ? "Saving..." : `✓ Import ${scanResults.length} More`}</button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 3 — Dish setup */}
          {step === 3 && (
            <div style={{ animation: "fadeIn 0.4s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
                {["Scan Invoice", "Scan More?", "Your Top Dish", "Results"].map((label, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flex: i < 3 ? 1 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: i < 2 ? T.accent : i === 2 ? T.accent : T.faint, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontFamily: T.font, fontWeight: 800, color: i <= 2 ? "#0f1410" : T.muted, flexShrink: 0 }}>{i < 2 ? "✓" : i + 1}</div>
                      <div style={{ fontSize: 10, color: i === 2 ? T.accent : T.muted, fontFamily: T.body, whiteSpace: "nowrap" }}>{label}</div>
                    </div>
                    {i < 3 && <div style={{ flex: 1, height: 1, background: i < 2 ? T.accent : T.faint }} />}
                  </div>
                ))}
              </div>

              <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 24, color: T.text, marginBottom: 8 }}>What's your most popular dish?</div>
              <div style={{ fontSize: 14, color: T.muted, fontFamily: T.body, lineHeight: 1.6, marginBottom: 24 }}>
                Enter your best seller and we'll calculate its real food cost using the {ingredients.length} ingredients you just scanned.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <Input label="Dish Name" value={dishName} onChange={v => { setDishName(v); setAiError(null); }} placeholder="e.g. Classic Burger" />
                  </div>
                  <div style={{ width: 120 }}>
                    <Input label="Sale Price ($)" value={dishPrice} onChange={setDishPrice} type="number" placeholder="12.99" />
                  </div>
                </div>

                {dishName && uniqueIngredients.length > 0 && (
                  <button onClick={aiSuggest} disabled={aiLoading} style={{ background: "linear-gradient(135deg, #4eca6e33, #4eca6e11)", border: `2px solid ${T.accent}`, color: T.accent, borderRadius: 10, padding: "12px", fontSize: 14, fontFamily: T.font, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, animation: !aiLoading ? "tourPulse 2s ease-in-out infinite" : "none" }}>
                    ✨ {aiLoading ? "AI is thinking..." : "Auto-Fill Recipe with AI"}
                  </button>
                )}
                {aiError && <div style={{ background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: T.warn, fontFamily: T.body }}>🤔 {aiError}</div>}

                <div>
                  <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 10 }}>Recipe (per serving) — edit as needed</div>
                  {dishIngredients.map((row, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 28px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                      <select value={row.ingredient_name} onChange={e => updateDishRow(i, "ingredient_name", e.target.value)} style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 6, padding: "9px 10px", color: row.ingredient_name ? T.text : T.muted, fontSize: 12, fontFamily: T.body, outline: "none" }}>
                        <option value="">Select...</option>
                        {uniqueIngredients.map(ing => <option key={ing.id} value={ing.name}>{ing.name}</option>)}
                      </select>
                      <input value={row.qty} onChange={e => updateDishRow(i, "qty", e.target.value)} placeholder="Qty" type="number" style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 6, padding: "9px 8px", color: T.text, fontSize: 12, fontFamily: T.body, outline: "none" }} />
                      <select value={row.qty_unit} onChange={e => updateDishRow(i, "qty_unit", e.target.value)} style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 6, padding: "9px 6px", color: T.text, fontSize: 12, fontFamily: T.body, outline: "none" }}>
                        {RECIPE_UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                      <button onClick={() => removeDishRow(i)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 16, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                    </div>
                  ))}
                  <button onClick={addDishRow} style={{ background: "none", border: `1px dashed ${T.border}`, borderRadius: 6, color: T.muted, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontFamily: T.body, width: "100%", marginTop: 4 }}>+ Add ingredient</button>
                </div>

                {/* Live preview */}
                {dishPrice && cost > 0 && (
                  <div style={{ background: T.faint, borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>Food cost: <strong style={{ color: T.text }}>{fmt$2(cost)}</strong></div>
                      <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>Profit per plate: <strong style={{ color: profit > 0 ? T.accent : T.warn }}>{fmt$2(profit)}</strong></div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 28, color: marginColor, fontFamily: T.font, fontWeight: 800 }}>{fmtPct(margin)}</div>
                      <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>margin</div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                <button onClick={() => setStep(2)} style={{ background: "none", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 8, padding: "12px 16px", fontSize: 13, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>← Back</button>
                <button onClick={saveDish} disabled={saving || !dishName || !dishPrice} style={{ flex: 1, background: dishName && dishPrice ? T.accent : T.faint, color: dishName && dishPrice ? "#0f1410" : T.muted, border: "none", borderRadius: 8, padding: "14px", fontSize: 15, fontFamily: T.font, fontWeight: 800, cursor: dishName && dishPrice ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
                  {saving ? "Saving..." : "See My Results →"}
                </button>
              </div>
              <button onClick={async () => { await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", session.user.id); onComplete(); }} style={{ display: "block", margin: "12px auto 0", background: "none", border: "none", color: T.muted, fontSize: 12, fontFamily: T.body, cursor: "pointer", textDecoration: "underline" }}>
                Skip — go to dashboard
              </button>
            </div>
          )}

          {/* Tracker Done Screen */}
          {step === "tracker_done" && (
            <div style={{ animation: "fadeIn 0.5s ease", textAlign: "center" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
              <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 28, color: T.text, marginBottom: 8 }}>
                You're all set!
              </div>
              <div style={{ fontSize: 15, color: T.muted, fontFamily: T.body, marginBottom: 32, lineHeight: 1.7, maxWidth: 400, margin: "0 auto 32px" }}>
                KitchenIQ is now tracking prices for <strong style={{ color: T.text }}>{ingredients.length} ingredients</strong> across your suppliers. Here's what happens next.
              </div>

              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "24px 28px", marginBottom: 24, textAlign: "left" }}>
                <div style={{ fontSize: 13, color: T.accent, fontFamily: T.font, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>What to expect</div>
                {[
                  { icon: "📸", title: "Scan every invoice that comes in", desc: "Each scan adds a new price data point. The more you scan, the better your history gets." },
                  { icon: "⚡", title: "Price changes appear automatically", desc: "When an ingredient price changes from one invoice to the next, it shows up in your Price Alerts tab instantly." },
                  { icon: "📊", title: "Price history builds over time", desc: "Your dashboard tracks price trends per ingredient so you can see what's going up and when." },
                  { icon: "🔒", title: "Want margin calculations?", desc: "Upgrade to the Full plan anytime to unlock recipe costing, menu margins, and AI suggestions." },
                ].map(item => (
                  <div key={item.title} style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                    <div style={{ fontSize: 22, flexShrink: 0 }}>{item.icon}</div>
                    <div>
                      <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 3 }}>{item.title}</div>
                      <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, lineHeight: 1.5 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={onComplete} style={{ width: "100%", background: T.accent, color: "#0f1410", border: "none", borderRadius: 10, padding: "16px", fontSize: 16, fontFamily: T.font, fontWeight: 800, cursor: "pointer", boxShadow: `0 0 32px ${T.accent}55`, marginBottom: 12 }}>
                Take Me to My Dashboard →
              </button>
              <button onClick={() => window.location.href = "/#/paywall"} style={{ width: "100%", background: "none", border: `1px solid ${T.accentMid}`, color: T.accent, borderRadius: 10, padding: "12px", fontSize: 13, fontFamily: T.font, fontWeight: 700, cursor: "pointer" }}>
                Upgrade to Full Plan — Unlock Margins →
              </button>
            </div>
          )}

          {/* Step 4 — Holy shit moment */}
          {step === 4 && (
            <div style={{ animation: "fadeIn 0.5s ease", textAlign: "center" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>{isBad ? "⚠️" : "🎉"}</div>
              <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 28, color: T.text, marginBottom: 8 }}>
                {isBad ? "Your margins need attention" : "Here's your real number"}
              </div>
              <div style={{ fontSize: 15, color: T.muted, fontFamily: T.body, marginBottom: 32 }}>
                This updates automatically every time you scan a new invoice.
              </div>

              <div style={{ background: T.card, border: `2px solid ${isBad ? T.warn + "88" : T.accentMid}`, borderRadius: 16, padding: "28px 32px", marginBottom: 24, boxShadow: isBad ? `0 0 32px ${T.warn}18` : `0 0 32px ${T.accent}18` }}>
                <div style={{ fontSize: 18, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 20 }}>{dishName}</div>
                <div style={{ fontSize: 64, color: marginColor, fontFamily: T.font, fontWeight: 800, lineHeight: 1, marginBottom: 8 }}>{cost > 0 ? fmtPct(margin) : "—"}</div>
                <div style={{ fontSize: 14, color: T.muted, fontFamily: T.body, marginBottom: 20 }}>margin</div>
                {cost > 0 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 32, fontSize: 14, color: T.muted, fontFamily: T.body, paddingTop: 16, borderTop: `1px solid ${T.faint}` }}>
                    <span>Food cost: <strong style={{ color: T.text }}>{fmt$2(cost)}</strong></span>
                    <span>Sale price: <strong style={{ color: T.text }}>{fmt$2(sale)}</strong></span>
                    <span>Profit: <strong style={{ color: profit > 0 ? T.accent : T.warn }}>{fmt$2(profit)}</strong></span>
                  </div>
                )}
              </div>

              {isBad && suggestedPrice && (
                <div style={{ background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 12, padding: "16px 20px", marginBottom: 24, textAlign: "left" }}>
                  <div style={{ fontSize: 14, color: T.warn, fontFamily: T.font, fontWeight: 700, marginBottom: 4 }}>💰 Pricing suggestion</div>
                  <div style={{ fontSize: 13, color: T.text, fontFamily: T.body }}>
                    Raise <strong>{dishName}</strong> to <strong>{fmt$2(suggestedPrice)}</strong> (+{fmt$2(suggestedPrice - sale)}) to hit 65% margin. That's an extra <strong style={{ color: T.accent }}>{fmt$2(suggestedPrice - sale)} per plate</strong>.
                  </div>
                </div>
              )}

              {cost === 0 && (
                <div style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 12, padding: "14px 18px", marginBottom: 24, fontSize: 14, color: T.accent, fontFamily: T.body }}>
                  📸 Scan more invoices from the Ingredients tab to fill in your food costs and see your real margin.
                </div>
              )}

              <button onClick={onComplete} style={{ width: "100%", background: T.accent, color: "#0f1410", border: "none", borderRadius: 10, padding: "16px", fontSize: 16, fontFamily: T.font, fontWeight: 800, cursor: "pointer", boxShadow: `0 0 32px ${T.accent}55` }}>
                Take Me to My Dashboard →
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}


const TABS = ["Dashboard", "Ingredients", "Menu Items", "Price Alerts", "Account", "Support"];
const ICONS = ["⬡", "🥬", "🍽", "⚡", "👤", "💬"];

function KitchenIQApp() {
  const { route, navigate } = useRoute();
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const [ingredients, setIngredients] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [priceNotif, setPriceNotif] = useState(null);
  const [isRecovery, setIsRecovery] = useState(false);
  const [showDemoTransition, setShowDemoTransition] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showCheckoutTransition, setShowCheckoutTransition] = useState(false);

  const goToDemo = () => setShowDemoTransition(true);

  const signOut = async () => {
    setSigningOut(true);
    setTimeout(async () => {
      await supabase.auth.signOut();
      setIngredients([]); setMenuItems([]); setProfile(null); setIsRecovery(false);
      setSigningOut(false);
    }, 1600);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    const fetchProfile = async () => {
      setProfileLoading(true);
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      setProfile(data);
      setProfileLoading(false);
    };
    fetchProfile();
  }, [session]);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      window.history.replaceState({}, "", "/");
      setShowCheckoutTransition(true);
      // Google Ads conversion tracking
      if (typeof gtag !== "undefined") {
        gtag("event", "conversion", {
          send_to: "AW-18071916084/pNXSCN-qgJkcELScrqlD",
          transaction_id: "",
        });
      }
      if (session) {
        setTimeout(async () => {
          const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
          setProfile(data);
          setShowCheckoutTransition(false);
        }, 2200);
      }
    }
  }, [session]);

  // ── All hooks above. All conditional returns below. ──

  if (signingOut) return <AppTransition message="Signing out..." submessage="See you next time" duration={1600} />;
  if (showCheckoutTransition) return <AppTransition message="Payment confirmed!" submessage="Setting up your KitchenIQ account" duration={2200} />;
  if (session === undefined) return <AppTransition message="Loading KitchenIQ..." submessage="Just a moment" />;
  if (isRecovery && session) return <SetNewPasswordScreen onDone={() => { setIsRecovery(false); window.history.replaceState({}, "", "/"); }} />;

  if (!session) {
    if (route === "/#/demo" || route === "/demo") return (
      <DemoScreen onSignUp={() => navigate("/#/auth")} onLogin={() => navigate("/#/auth")} onBack={() => navigate("/#/")} />
    );
    if (route === "/#/auth" || route === "/auth") return (
      <AuthScreen onBack={() => navigate("/#/")} />
    );
    return (
      <>
        {showDemoTransition && (
          <DemoTransition onComplete={() => { setShowDemoTransition(false); navigate("/#/demo"); }} />
        )}
        <LandingPage onSignUp={() => navigate("/#/auth")} onLogin={() => navigate("/#/auth")} onDemo={goToDemo} />
      </>
    );
  }

  if (profileLoading || loading) return <AppTransition message="Loading your restaurant..." submessage="Fetching your ingredients and menu" />;
  if (!profile?.is_subscribed) return <PaywallScreen session={session} />;
  if (!profile?.onboarding_completed) return (
    <OnboardingWizard
      session={session}
      ingredients={ingredients}
      setIngredients={setIngredients}
      menuItems={menuItems}
      setMenuItems={setMenuItems}
      tier={profile?.subscription_tier}
      onComplete={async () => {
        await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", session.user.id);
        setProfile(p => ({ ...p, onboarding_completed: true }));
      }}
    />
  );

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: T.bg, fontFamily: T.body, color: T.text, boxSizing: "border-box", overflowX: "hidden" }}>
      <div style={{ borderBottom: `1px solid ${T.border}`, background: T.card }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: T.accentDim, border: `1px solid ${T.accentMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⬡</div>
            <span style={{ fontFamily: T.font, fontWeight: 800, fontSize: 18, color: T.text }}>Kitchen<span style={{ color: T.accent }}>IQ</span></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>{session.user.email}</span>
            <button onClick={() => exportCSV(ingredients, menuItems)} style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, color: T.accent, borderRadius: 6, padding: "7px 14px", fontSize: 12, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>↓ CSV</button>
            <button onClick={signOut} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 6, padding: "7px 14px", fontSize: 12, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>Sign Out</button>
          </div>
        </div>
      </div>
      <div style={{ borderBottom: `1px solid ${T.border}`, background: T.card }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", overflowX: "auto" }}>
          {TABS.map((t, i) => {
            const alertCount = i === 3 ? getPriceAlerts(ingredients).length : 0;
            return (
              <button key={i} onClick={() => setTab(i)} style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === i ? T.accent : "transparent"}`, color: tab === i ? T.accent : T.muted, padding: "14px 20px", fontSize: 13, fontFamily: T.font, fontWeight: 600, cursor: "pointer", transition: "color 0.15s", letterSpacing: "0.03em", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                {ICONS[i]} {t}
                {alertCount > 0 && <span style={{ background: T.warn, color: "#fff", borderRadius: 10, fontSize: 10, padding: "2px 6px", fontFamily: T.font, fontWeight: 700, lineHeight: 1 }}>{alertCount}</span>}
              </button>
            );
          })}
        </div>
      </div>
      {priceNotif && priceNotif.length > 0 && (
        <div style={{ padding: "0 16px", marginTop: 12 }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {priceNotif.map((c, idx) => (
              <div key={idx} style={{ background: "#1a0a00", border: `1px solid ${T.warn}`, borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 12, animation: "slideInDown 0.4s ease" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.warn, flexShrink: 0, boxShadow: `0 0 8px ${T.warn}`, marginTop: 5 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: T.warn, fontFamily: T.font, fontWeight: 700 }}>
                    ⚠ {c.name} {c.pct > 0 ? "increased" : "decreased"} {Math.abs(c.pct).toFixed(0)}% — ${Number(c.oldPrice).toFixed(2)} → ${Number(c.newPrice).toFixed(2)}
                  </div>
                  {c.affectedDishes && c.affectedDishes.length > 0 ? (
                    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                      {c.affectedDishes.map((d, i) => (
                        <div key={i} style={{ fontSize: 12, color: d.impact > 0 ? T.warn : T.accent, fontFamily: T.body }}>
                          {d.impact > 0 ? "↑" : "↓"} {d.dish} costs {d.impact > 0 ? "+" : ""}{fmt$2(d.impact)} more per plate
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 3 }}>No menu items affected</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => { setTab(3); setPriceNotif(null); }} style={{ background: T.warn, color: "#0f1410", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontFamily: T.font, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>View Alerts →</button>
                  <button onClick={() => setPriceNotif(null)} style={{ background: "none", border: "none", color: T.muted, fontSize: 18, cursor: "pointer", padding: "0 4px" }}>×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ width: "100%", padding: "24px 16px", boxSizing: "border-box" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {loading
            ? <div style={{ textAlign: "center", color: T.muted, fontFamily: T.body, padding: 60 }}>Loading your data...</div>
            : <>
              {tab === 0 && <Dashboard ingredients={ingredients} menuItems={menuItems} onNavigate={setTab} tier={profile?.subscription_tier} />}
              {tab === 1 && <IngredientsView ingredients={ingredients} setIngredients={setIngredients} userId={session.user.id} userEmail={session.user.email} menuItems={menuItems} onPriceChange={(changes) => { setPriceNotif(changes); setTimeout(() => setPriceNotif(null), 12000); }} />}
              {tab === 2 && (profile?.subscription_tier === "tracker"
                ? <TrackerUpgradeGate feature="Menu Items & Margin Calculations" />
                : <MenuView menuItems={menuItems} setMenuItems={setMenuItems} ingredients={ingredients} userId={session.user.id} />
              )}
              {tab === 3 && <AlertsView ingredients={ingredients} />}
              {tab === 4 && <AccountView session={session} profile={profile} onProfileUpdate={setProfile} onSignOut={signOut} />}
              {tab === 5 && <SupportView session={session} />}
            </>}
        </div>
      </div>
    </div>
  );
}

export default function KitchenIQ() {
  return (
    <ErrorBoundary>
      <KitchenIQApp />
    </ErrorBoundary>
  );
}