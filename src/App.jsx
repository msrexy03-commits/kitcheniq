import { useState, useEffect, Component } from "react";
import { createClient } from "@supabase/supabase-js";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

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
            <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 22, color: "#e8f0e9", marginBottom: 10 }}>
              Something went wrong
            </div>
            <div style={{ fontSize: 14, color: "#6b8a6e", fontFamily: "'Inter', sans-serif", lineHeight: 1.6, marginBottom: 28 }}>
              KitchenIQ ran into an unexpected error. Your data is safe — try refreshing the page. If it keeps happening, contact jake@trykitcheniq.com.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{ background: "#4eca6e", color: "#0f1410", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 14, fontFamily: "'Outfit', sans-serif", fontWeight: 700, cursor: "pointer", marginRight: 12 }}>
              Refresh Page
            </button>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{ background: "transparent", color: "#6b8a6e", border: "1px solid #1e2b1f", borderRadius: 8, padding: "12px 28px", fontSize: 14, fontFamily: "'Outfit', sans-serif", fontWeight: 600, cursor: "pointer" }}>
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

// ─── Supply Detection ─────────────────────────────────────────────────────────
// Automatically detects non-food supply items based on name keywords
const SUPPLY_KEYWORDS = [
  "napkin", "towel", "cup", "bag", "box", "glove", "cleaner", "sanitizer",
  "soap", "bleach", "surcharge", "fuel surcharge", "delivery fee", "picks",
  "frill pick", "straw", "foil", "container", "lid", "utensil", "tissue",
  "paper plate", "spoon", "fork", "knife set", "tray liner", "pan liner",
  "trash", "garbage", "waste", "mop", "broom", "sponge", "scrubber",
  "detergent", "degreaser", "disinfectant"
];

function detectIsSupply(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return SUPPLY_KEYWORDS.some(kw => lower.includes(kw));
}


const BRAND_NAMES = ["hormel", "sysco", "tyson", "perdue", "foster farms", "pilgrims", "swift", "cargill", "kraft", "heinz", "hunts", "dole", "del monte", "land o lakes", "dean", "saputo", "prairie fresh"];
const DESCRIPTOR_WORDS = [
  "link", "links", "patty", "patties", "sliced", "slice", "fresh", "frozen",
  "raw", "cooked", "smoked", "cured", "boneless", "skinless", "whole", "half",
  "thick", "thin", "lean", "extra", "natural", "organic", "grade", "choice",
  "select", "premium", "regular", "original", "classic", "style", "type",
  "cut", "cuts", "pack", "package", "bag", "box", "can", "jar", "bottle",
  "bulk", "retail", "foodservice", "portion", "portions", "serving", "servings"
];

// Ingredient-type tokens weighted higher in similarity scoring
const HIGH_WEIGHT_TOKENS = new Set([
  "beef", "chicken", "pork", "bacon", "ham", "turkey", "sausage", "egg",
  "cheese", "butter", "cream", "milk", "fish", "shrimp", "salmon", "tuna",
  "bread", "flour", "sugar", "oil", "potato", "tomato", "onion", "pepper"
]);

function normalizeNameForGrouping(name) {
  let n = name.trim().toLowerCase().replace(/\s+/g, " ");
  BRAND_NAMES.forEach(b => { n = n.replace(new RegExp(`\\b${b}\\b`, "g"), ""); });
  DESCRIPTOR_WORDS.forEach(d => { n = n.replace(new RegExp(`\\b${d}\\b`, "g"), ""); });
  return n
    .replace(/\s+/g, " ")
    .replace(/(\w)s\b/g, "$1")
    .replace(/[^a-z0-9 /]/g, "")
    .trim();
}

// Token-overlap similarity — high-weight ingredient tokens count double
// Returns 0.0 to 1.0
function tokenSimilarity(a, b) {
  if (!a || !b) return 0;
  const tokA = new Set(a.split(" ").filter(Boolean));
  const tokB = new Set(b.split(" ").filter(Boolean));
  if (!tokA.size || !tokB.size) return 0;
  let shared = 0, total = 0;
  new Set([...tokA, ...tokB]).forEach(t => {
    const w = HIGH_WEIGHT_TOKENS.has(t) ? 2 : 1;
    total += w;
    if (tokA.has(t) && tokB.has(t)) shared += w;
  });
  return total > 0 ? shared / total : 0;
}

// Find best ingredient match using: alias → exact normalized → fuzzy (>=0.75)
function findBestIngredientMatch(rawName, ingredients, aliases = []) {
  if (!rawName || !ingredients?.length) return null;
  // 1. Alias lookup
  const alias = aliases.find(a => a.raw_name.toLowerCase() === rawName.toLowerCase());
  if (alias) {
    const m = ingredients.filter(i => i.name.toLowerCase() === alias.canonical_name.toLowerCase())
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    if (m) return { ingredient: m, confidence: 1.0, method: "alias" };
  }
  const normRaw = normalizeNameForGrouping(rawName);
  // 2. Exact normalized
  const exact = ingredients.filter(i => normalizeNameForGrouping(i.name) === normRaw)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  if (exact) return { ingredient: exact, confidence: 1.0, method: "exact" };
  // 3. Token-overlap fuzzy
  let best = 0, bestIng = null;
  ingredients.forEach(ing => {
    const score = tokenSimilarity(normRaw, normalizeNameForGrouping(ing.name));
    if (score > best) { best = score; bestIng = ing; }
  });
  if (best >= 0.75) return { ingredient: bestIng, confidence: best, method: "fuzzy" };
  return null;
}

function calcRecipeCost(row, ingredients, aliases = []) {
  const match = findBestIngredientMatch(row.ingredient_name || "", ingredients, aliases);
  if (!match) return Number(row.cost) || 0;
  const unitCost = getUnitCost(match.ingredient);
  if (!unitCost) return Number(row.cost) || 0;
  const qty = Number(row.qty) || 0;
  const converted = convertUnits(qty, row.qty_unit, match.ingredient.case_unit);
  return unitCost * converted;
}

function calcMenuStats(item, ingredients = [], aliases = []) {
  const cost = (item.ingredients || []).reduce((s, row) => s + calcRecipeCost(row, ingredients, aliases), 0);
  const profit = Number(item.sale_price) - cost;
  const margin = item.sale_price > 0 ? (profit / item.sale_price) * 100 : 0;
  return { cost, profit, margin };
}

function getPriceAlerts(ingredients, aliases = []) {
  const grouped = {};
  ingredients.forEach((ing) => {
    const normKey = normalizeNameForGrouping(ing.name);
    let placed = false;
    for (const existingKey of Object.keys(grouped)) {
      if (tokenSimilarity(normKey, existingKey) >= 0.8) {
        grouped[existingKey].push(ing);
        placed = true;
        break;
      }
    }
    if (!placed) grouped[normKey] = [ing];
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
  bg: "#0a0d0a", card: "#131713", border: "#1e2b1f",
  accent: "#4eca6e", accentDim: "#4eca6e1a", accentMid: "#4eca6e50",
  warn: "#e8854a", warnDim: "#e8854a1a",
  text: "#edf2ee", muted: "#9ab89e", faint: "#1a231a",
  font: "'Outfit', sans-serif", body: "'Inter', sans-serif",
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

// ─── Image Enhancement ────────────────────────────────────────────────────────
// Converts invoice photo to grayscale, boosts contrast, and sharpens text
// before sending to Claude — improves OCR accuracy significantly
function enhanceInvoiceImage(base64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Cap dimensions to 1600px on longest edge — iPhone photos are 4032×3024 which exceeds API 5MB limit
      const MAX = 1600;

      // If image is wider than tall it's likely a sideways phone photo of a portrait invoice — rotate 90°
      const needsRotation = img.width > img.height;
      const naturalW = needsRotation ? img.height : img.width;
      const naturalH = needsRotation ? img.width : img.height;

      const scale = Math.min(1, MAX / Math.max(naturalW, naturalH));
      const w = Math.round(naturalW * scale);
      const h = Math.round(naturalH * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");

      if (needsRotation) {
        ctx.translate(0, w);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(img, 0, 0, h, w);
        ctx.rotate(Math.PI / 2);
        ctx.translate(0, -w);
      } else {
        ctx.drawImage(img, 0, 0, w, h);
      }

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      // Step 1 — Grayscale
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = data[i + 1] = data[i + 2] = gray;
      }

      // Step 2 — Auto contrast
      let min = 255, max = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < min) min = data[i];
        if (data[i] > max) max = data[i];
      }
      const range = max - min || 1;
      for (let i = 0; i < data.length; i += 4) {
        const stretched = ((data[i] - min) / range) * 255;
        data[i] = data[i + 1] = data[i + 2] = Math.min(255, Math.max(0, stretched));
      }

      // Step 3 — Sharpen
      ctx.putImageData(imageData, 0, 0);
      const sharpened = ctx.getImageData(0, 0, w, h);
      const src = imageData.data;
      const dst = sharpened.data;
      const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let val = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * w + (x + kx)) * 4;
              val += src[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
            }
          }
          const idx = (y * w + x) * 4;
          const clamped = Math.min(255, Math.max(0, val));
          dst[idx] = dst[idx + 1] = dst[idx + 2] = clamped;
          dst[idx + 3] = 255;
        }
      }
      ctx.putImageData(sharpened, 0, 0);

      // Export at 0.82 quality — keeps file well under 5MB API limit
      const enhanced = canvas.toDataURL("image/jpeg", 0.82).split(",")[1];
      resolve(enhanced);
    };
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

// ─── Invoice Scanner ──────────────────────────────────────────────────────────
function InvoiceScanner({ onIngredientsFound, onClose, userId, onAliasSaved, ingredientProfiles = [] }) {
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState(null);
  const [rawRows, setRawRows] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = (file) => {
    if (!file) return;
    setResults(null); setRawRows(null); setError(null);
    setImage(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = (e) => setImageBase64(e.target.result.split(",")[1]);
    reader.readAsDataURL(file);
  };

  const scan = async () => {
    if (!imageBase64) return;
    setScanning(true); setError(null);
    try {
      const enhanced = await enhanceInvoiceImage(imageBase64);

      const response = await fetch("/api/scan-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: enhanced }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Scan failed");
      if (!data.items || data.items.length === 0) throw new Error("NO_ITEMS");

      const withIds = data.items.map((r, i) => ({
        ...normalizeIngredient(r),
        is_supply: r.is_supply || detectIsSupply(r.name),
        _id: `row_${i}_${Date.now()}`,
        _originalName: r.name,
        _col5: null,
        _col6: null,
        _qty: 1,
      }));
      setResults(withIds);

    } catch (e) {
      console.error("Scan error:", e.message);
      if (e.message === "NO_ITEMS") {
        setError("Couldn't find any line items. Make sure the invoice is fully visible and try again.");
      } else {
        setError(`Scan failed: ${e.message}`);
      }
    }
    setScanning(false);
  };

  const updateResult = (id, field, val) => {
    setResults(prev => prev.map(r => r._id === id ? { ...r, [field]: val } : r));
  };

  const removeResult = (id) => {
    setResults(prev => prev.filter(r => r._id !== id));
  };

  const flagSuspiciousItems = (items) => {
    if (!items || items.length === 0) return [];
    const prices = items.map(r => Number(r.price)).filter(p => p > 0);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

    return items.map((r) => {
      const price = Number(r.price);
      const flags = [];

      // Check profile memory first — if this is a known item with expected price, auto-confirm
      const profile = ingredientProfiles.find(p =>
        tokenSimilarity(normalizeNameForGrouping(p.canonical_name), normalizeNameForGrouping(r.name)) >= 0.8
      );

      if (profile && profile.scan_count >= 3) {
        // Known item — only auto-confirm if price is within 20% of historical average
        const avgKnown = Number(profile.avg_price);
        const priceDeviation = avgKnown > 0 ? Math.abs(price - avgKnown) / avgKnown : 1;
        if (priceDeviation <= 0.20) {
          // Price looks normal for this known item — no flags, mark as profile-confirmed
          return { ...r, _flags: [], _profileConfirmed: true, _profileName: profile.canonical_name };
        } else {
          // Known item but price is way off — flag it
          flags.push(`Price differs significantly from usual $${avgKnown.toFixed(2)} — verify this is correct`);
          return { ...r, _flags: flags, _profileConfirmed: false };
        }
      }

      // New item — run standard flag detection
      if (price > avgPrice * 4 && items.length > 2) {
        flags.push("Price seems too high — may be extended total, not unit price");
      }
      const otherPrices = prices.filter(p => Math.abs(p - price) > 0.01);
      const couldBeExtended = otherPrices.some(p => {
        for (let qty = 2; qty <= 10; qty++) {
          if (Math.abs(price - p * qty) < 0.5) return true;
        }
        return false;
      });
      if (couldBeExtended && price > avgPrice * 1.5) {
        flags.push("Might be qty × unit price — double check this one");
      }
      const name = (r.name || "").toLowerCase();
      if ((name.includes("beef") || name.includes("chicken") || name.includes("pork") || name.includes("bacon") || name.includes("steak")) && price < 5) {
        flags.push("Price seems very low for a meat item — check case price vs unit price");
      }
      if ((name.includes("cheese") || name.includes("cream") || name.includes("butter")) && price < 3) {
        flags.push("Price seems very low for a dairy item — verify");
      }
      if (!r.case_size || Number(r.case_size) === 0) {
        flags.push("Missing case size — unit cost can't be calculated");
      }

      return { ...r, _flags: flags, _profileConfirmed: false };
    });
  };

  const flaggedResults = results ? flagSuspiciousItems(results) : null;
  const flagCount = flaggedResults ? flaggedResults.filter(r => r._flags && r._flags.length > 0).length : 0;
  const [safeExpanded, setSafeExpanded] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const confirmImport = async () => {
    const cleaned = results.map(({ _id, _flags, _col5, _col6, _qty, _originalName, ...r }) => ({
      ...r, price: Number(r.price), case_size: r.case_size ? Number(r.case_size) : null
    }));
    // Save aliases for any items where the user changed the name
    if (userId && onAliasSaved) {
      const aliasRows = results
        .filter(r => r._originalName && r._originalName.toLowerCase() !== r.name.toLowerCase())
        .map(r => ({ user_id: userId, raw_name: r._originalName, canonical_name: r.name }));
      if (aliasRows.length > 0) {
        const { data } = await supabase.from("ingredient_aliases")
          .upsert(aliasRows, { onConflict: "user_id,raw_name" })
          .select();
        if (data) onAliasSaved(data);
      }
    }
    onIngredientsFound(cleaned);
    onClose();
  };

  // Generate price suggestions from real Pass 1 column context
  const getPriceSuggestions = (r) => {
    const suggestions = new Set();
    const price = Number(r.price);
    const col5 = r._col5;
    const col6 = r._col6;
    const qty = r._qty || 1;

    // If col6 is the extended price, col6/qty is the real unit price
    if (col6 && qty > 1) {
      const derived = parseFloat((col6 / qty).toFixed(2));
      if (derived > 0 && Math.abs(derived - price) > 0.01) suggestions.add(derived.toFixed(2));
    }
    // If col5 exists and differs from current price, offer it
    if (col5 && Math.abs(col5 - price) > 0.01) suggestions.add(col5.toFixed(2));
    // If col6 exists and differs, offer it (in case col6 is actually the unit price)
    if (col6 && Math.abs(col6 - price) > 0.01 && col6 < price) suggestions.add(col6.toFixed(2));
    // Fallback: divide by common quantities if no column context
    if (suggestions.size === 0) {
      [2, 3, 4].forEach(q => {
        const s = parseFloat((price / q).toFixed(2));
        if (s > 0) suggestions.add(s.toFixed(2));
      });
    }
    return [...suggestions].slice(0, 3);
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

        {results && flaggedResults && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 420, overflowY: "auto" }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, color: T.accent, fontFamily: T.font, fontWeight: 700 }}>
                ✓ {results.length} items found
                {flaggedResults.filter(r => r._profileConfirmed).length > 0 && (
                  <span style={{ fontSize: 11, color: T.muted, fontFamily: T.body, fontWeight: 400, marginLeft: 8 }}>
                    · {flaggedResults.filter(r => r._profileConfirmed).length} recognised from previous invoices
                  </span>
                )}
              </div>
              {flagCount > 0 && (
                <div style={{ fontSize: 12, color: T.warn, fontFamily: T.body, background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 20, padding: "3px 10px" }}>
                  ⚠ {flagCount} need review
                </div>
              )}
            </div>

            {/* Flagged items — shown first, expanded */}
            {flaggedResults.filter(r => r._flags && r._flags.length > 0).map((r) => {
              const suggestions = getPriceSuggestions(r);
              const isEditing = editingId === r._id;
              return (
                <div key={r._id} style={{ background: T.warnDim, border: `1px solid ${T.warn}66`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ fontSize: 13, color: T.text, fontFamily: T.font, fontWeight: 700, flex: 1, marginRight: 8 }}>{r.name}</div>
                    <button onClick={() => removeResult(r._id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 16, cursor: "pointer", padding: "0 4px", flexShrink: 0 }}>×</button>
                  </div>

                  {r._flags.map((flag, fli) => (
                    <div key={fli} style={{ fontSize: 11, color: T.warn, fontFamily: T.body, marginBottom: 8 }}>⚠ {flag}</div>
                  ))}

                  {/* Price fix — tap buttons from real column context */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, marginBottom: 5 }}>
                      Current price: <strong style={{ color: T.warn }}>${Number(r.price).toFixed(2)}</strong>
                      {r._col5 && r._col6 && <span style={{ color: T.muted }}> · suggested corrections based on invoice row</span>}
                      {" "}— tap to correct:
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {suggestions.map((s, si) => (
                        <button key={si} onClick={() => updateResult(r._id, "price", s)}
                          style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 12px", fontSize: 13, color: T.accent, fontFamily: T.font, fontWeight: 700, cursor: "pointer" }}>
                          ${s}
                        </button>
                      ))}
                      <button onClick={() => setEditingId(isEditing ? null : r._id)}
                        style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 12px", fontSize: 12, color: T.muted, fontFamily: T.body, cursor: "pointer" }}>
                        ✏ Enter manually
                      </button>
                    </div>
                    {isEditing && (
                      <input autoFocus value={r.price} onChange={(e) => updateResult(r._id, "price", e.target.value)}
                        style={{ marginTop: 8, width: "100%", background: T.card, border: `1px solid ${T.warn}88`, borderRadius: 6, padding: "8px 12px", color: T.warn, fontSize: 14, fontFamily: T.body, outline: "none", boxSizing: "border-box" }} />
                    )}
                  </div>

                  {/* Case size + unit tap buttons */}
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>Case size:</div>
                    <input value={r.case_size || ""} onChange={(e) => updateResult(r._id, "case_size", e.target.value)} placeholder="e.g. 15"
                      style={{ width: 64, background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, padding: "5px 8px", color: T.text, fontSize: 12, fontFamily: T.body, outline: "none" }} />
                    {/* Common case size presets based on unit */}
                    {(r.case_unit === "lb" ? [10, 15, 20, 25, 30] :
                      r.case_unit === "oz" ? [16, 32, 64, 128] :
                      r.case_unit === "each" ? [12, 24, 36, 48, 180] :
                      []).map(preset => (
                      <button key={preset} onClick={() => updateResult(r._id, "case_size", String(preset))}
                        style={{ background: Number(r.case_size) === preset ? T.accent : T.faint, border: `1px solid ${Number(r.case_size) === preset ? T.accent : T.border}`, borderRadius: 5, padding: "4px 8px", fontSize: 11, color: Number(r.case_size) === preset ? "#0f1410" : T.muted, fontFamily: T.body, cursor: "pointer" }}>
                        {preset}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                    <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, marginRight: 2 }}>Unit:</div>
                    {["lb", "oz", "each", "gallon"].map(u => (
                      <button key={u} onClick={() => updateResult(r._id, "case_unit", u)}
                        style={{ background: r.case_unit === u ? T.accent : T.faint, border: `1px solid ${r.case_unit === u ? T.accent : T.border}`, borderRadius: 5, padding: "4px 8px", fontSize: 11, color: r.case_unit === u ? "#0f1410" : T.muted, fontFamily: T.body, cursor: "pointer", fontWeight: r.case_unit === u ? 700 : 400 }}>
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Safe items — collapsed */}
            {flaggedResults.filter(r => !r._flags || r._flags.length === 0).length > 0 && (
              <div style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
                <button onClick={() => setSafeExpanded(e => !e)}
                  style={{ width: "100%", background: "none", border: "none", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <div style={{ fontSize: 13, color: T.accent, fontFamily: T.font, fontWeight: 700 }}>
                    ✓ {flaggedResults.filter(r => !r._flags || r._flags.length === 0).length} items look correct
                    {flaggedResults.filter(r => r._profileConfirmed).length > 0 && (
                      <span style={{ fontSize: 11, color: T.muted, fontFamily: T.body, fontWeight: 400, marginLeft: 6 }}>
                        ({flaggedResults.filter(r => r._profileConfirmed).length} from memory)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>{safeExpanded ? "▲ collapse" : "▼ review anyway"}</div>
                </button>
                {safeExpanded && (
                  <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {flaggedResults.filter(r => !r._flags || r._flags.length === 0).map((r) => (
                      <div key={r._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: T.text, fontFamily: T.font, fontWeight: 600 }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, marginTop: 2 }}>
                            ${Number(r.price).toFixed(2)} · {r.case_size} {r.case_unit}
                            {r.case_size ? ` · $${(r.price / r.case_size).toFixed(4)}/unit` : ""}
                          </div>
                        </div>
                        <button onClick={() => removeResult(r._id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 16, cursor: "pointer", padding: "0 4px" }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          {!results
            ? <Btn onClick={scan} disabled={!imageBase64 || scanning} variant="ai">{scanning ? "⏳ Reading invoice..." : "🔍 Scan Invoice"}</Btn>
            : <>
                <Btn variant="ghost" onClick={() => { setResults(null); setRawRows(null); setImage(null); setImageBase64(null); setSafeExpanded(false); setEditingId(null); }}>Rescan</Btn>
                <Btn onClick={confirmImport}>✓ Import {results.length} Items</Btn>
              </>}
        </div>
      </div>
    </Modal>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ ingredients, menuItems, onNavigate, flashCard: externalFlash, chartOpacity: externalChartOpacity, tier, aliases = [] }) {
  const isMobile = useIsMobile();
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

  const alerts = getPriceAlerts(ingredients.filter(i => !i.is_supply));
  const yearStart = new Date(new Date().getFullYear() - 1, new Date().getMonth(), new Date().getDate()).toISOString().split("T")[0];
  const spikesCaught = alerts.filter(a => a.pct > 0 && a.date >= yearStart);
  const valueCaught = spikesCaught.reduce((sum, a) => sum + (a.newPrice - a.oldPrice), 0);
  const biggestSpike = spikesCaught.length ? spikesCaught.reduce((a, b) => Math.abs(b.pct) > Math.abs(a.pct) ? b : a) : null;

  const ingredientNames = [...new Set(ingredients.filter(i => !i.is_supply).map(i => i.name))].sort();
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

  // Menu suggestions — items with spikes or low margins
  const suggestions = tier !== "tracker" ? menuStats.map(m => {
    const issues = [];
    if (m.margin < 50 && m.cost > 0) {
      const suggestedPrice = m.cost / (1 - 0.65);
      issues.push({ type: "price", label: "Low Margin", message: `Raise to ${fmt$2(suggestedPrice)} to hit 65%` });
    }
    const spike = alerts.find(a => (m.ingredients || []).some(r => r.ingredient_name?.toLowerCase() === a.name?.toLowerCase()));
    if (spike) issues.push({ type: "spike", label: "Price Spike", message: `${spike.name.split(" ").slice(0,2).join(" ")} changed` });
    return issues.length > 0 ? { ...m, issues } : null;
  }).filter(Boolean) : [];

  const StatCard = ({ k, label, value, sub, accent, warn, onClick }) => (
    <div onClick={onClick} style={{
      background: T.card,
      border: `1px solid ${warn ? T.warn + "88" : accent ? T.accentMid : T.border}`,
      borderRadius: 10, padding: isMobile ? "12px 14px" : "16px 18px",
      animation: flashCard === k ? "cardFlash 0.9s ease" : "none",
      cursor: onClick ? "pointer" : "default",
      transition: "border-color 0.3s ease",
    }}>
      <div style={{ fontSize: 10, color: T.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: isMobile ? 24 : 28, color: warn ? T.warn : accent ? T.accent : T.text, fontFamily: T.font, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: warn ? T.warn : T.muted, marginTop: 4, fontFamily: T.body }}>{sub}</div>}
    </div>
  );

  const foodIngredients = ingredients.filter(i => !i.is_supply);
  const lastScan = foodIngredients.length
    ? foodIngredients.reduce((a, b) => new Date(b.created_at || b.date) > new Date(a.created_at || a.date) ? b : a)
    : null;
  const daysSinceLastScan = lastScan
    ? Math.floor((Date.now() - new Date(lastScan.created_at || lastScan.date)) / 86400000)
    : null;
  const lastScanLabel = daysSinceLastScan === null ? null
    : daysSinceLastScan === 0 ? "Scanned today"
    : daysSinceLastScan === 1 ? "Last scanned yesterday"
    : daysSinceLastScan <= 7 ? `Last scanned ${daysSinceLastScan}d ago`
    : `⚠ Last scanned ${daysSinceLastScan}d ago — data may be stale`;
  const lastScanWarn = daysSinceLastScan !== null && daysSinceLastScan > 7;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`@keyframes cardFlash { 0% { border-color: #1e2b1f; } 50% { border-color: #4eca6e; box-shadow: 0 0 16px #4eca6e33; } 100% { border-color: #1e2b1f; } }`}</style>
      <OnboardingBanner ingredients={ingredients} menuItems={menuItems} onNavigate={onNavigate} tier={tier} />

      {/* Last scanned indicator */}
      {lastScanLabel && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: lastScanWarn ? T.warn : T.accent, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: lastScanWarn ? T.warn : T.muted, fontFamily: T.body }}>{lastScanLabel}</span>
        </div>
      )}

      {/* ── TOP ROW: 2×2 stat grid + spike alerts + margin leaders ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>

        {/* 2×2 stat grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 10 }}>
          <StatCard k="ingredients" label="Ingredients" value={ingredients.filter(i => !i.is_supply).length} accent onClick={() => onNavigate(1)} />
          <StatCard k="menu" label="Menu Items" value={menuItems.length} onClick={() => onNavigate(2)} />
          <StatCard k="margin" label="Avg Margin" value={fmtPct(avgMargin)} sub={avgMargin > 60 ? "Healthy ✓" : avgMargin > 40 ? "Watch closely" : "⚠ Low"} accent={avgMargin > 60} warn={avgMargin < 50} onClick={() => onNavigate(2)} />
          <StatCard k="caught" label="Caught (12mo)" value={valueCaught > 0 ? fmt$2(valueCaught) : "—"} sub={biggestSpike ? `↑ ${biggestSpike.name.split(" ").slice(0,2).join(" ")} +${biggestSpike.pct.toFixed(0)}%` : "No spikes"} warn={valueCaught > 0} accent={valueCaught === 0} onClick={() => onNavigate(3)} />
        </div>

        {/* Price Spike Alerts widget */}
        <div style={{ background: T.card, border: `1px solid ${alerts.length > 0 ? T.warn + "55" : T.border}`, borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body }}>Price Spike Alerts</div>
            {alerts.length > 0 && <button onClick={() => onNavigate(3)} style={{ background: "none", border: "none", color: T.accent, fontSize: 11, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>View all →</button>}
          </div>
          {alerts.length === 0
            ? <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, flex: 1, display: "flex", alignItems: "center" }}>✓ All prices stable</div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                {alerts.slice(0, 4).map((a, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12, color: T.text, fontFamily: T.body, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{a.name}</div>
                    <div style={{ fontSize: 12, fontFamily: T.font, fontWeight: 700, color: a.pct > 0 ? T.warn : T.accent, flexShrink: 0 }}>
                      {a.pct > 0 ? "▲" : "▼"} {Math.abs(a.pct).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>}
        </div>

        {/* Margin Leaders widget */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 10, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 12 }}>Margin Leaders</div>
          {best ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              <div>
                <div style={{ fontSize: 10, color: T.muted, fontFamily: T.body, marginBottom: 3 }}>🏆 Best</div>
                <div style={{ fontSize: 13, color: T.accent, fontFamily: T.font, fontWeight: 700 }}>{best.name}</div>
                <div style={{ fontSize: 18, color: T.accent, fontFamily: T.font, fontWeight: 800 }}>{fmtPct(best.margin)}</div>
              </div>
              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                <div style={{ fontSize: 10, color: T.muted, fontFamily: T.body, marginBottom: 3 }}>⚠ Worst</div>
                <div style={{ fontSize: 13, color: T.warn, fontFamily: T.font, fontWeight: 700 }}>{worst.name}</div>
                <div style={{ fontSize: 18, color: T.warn, fontFamily: T.font, fontWeight: 800 }}>{fmtPct(worst.margin)}</div>
              </div>
            </div>
          ) : <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>No menu items yet</div>}
        </div>
      </div>

      {/* ── MIDDLE ROW: Menu suggestions + charts ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>

        {/* Menu suggestions — left */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column" }}>
          {tier === "tracker" ? (
            <>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 12 }}>Menu Suggestions</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                <div style={{ fontSize: 24 }}>🔒</div>
                <div>
                  <div style={{ fontSize: 13, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 4 }}>Full plan feature</div>
                  <a href="/#/paywall" style={{ fontSize: 12, color: T.accent, fontFamily: T.font, fontWeight: 600 }}>Upgrade to unlock →</a>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body }}>Menu Suggestions</div>
                {suggestions.length > 0 && <div style={{ fontSize: 11, color: T.warn, fontFamily: T.font, fontWeight: 700 }}>{suggestions.length} need attention</div>}
              </div>
              {suggestions.length === 0
                ? <div style={{ fontSize: 13, color: T.accent, fontFamily: T.body, flex: 1, display: "flex", alignItems: "center" }}>✓ All menu items healthy</div>
                : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {suggestions.map((m, idx) => (
                      <div key={idx} style={{ background: T.faint, borderRadius: 8, padding: "12px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ fontSize: 13, color: T.text, fontFamily: T.font, fontWeight: 700 }}>{m.name}</div>
                          <div style={{ fontSize: 14, color: m.margin < 50 ? T.warn : "#e8c84a", fontFamily: T.font, fontWeight: 800 }}>{fmtPct(m.margin)}</div>
                        </div>
                        {m.issues.map((issue, ii) => (
                          <div key={ii} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: issue.type === "spike" ? "#e8c84a11" : T.warnDim, border: `1px solid ${issue.type === "spike" ? "#e8c84a44" : T.warn + "44"}`, borderRadius: 6, padding: "6px 10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 10, color: issue.type === "spike" ? "#e8c84a" : T.warn, fontFamily: T.font, fontWeight: 700 }}>⚡ {issue.label}</span>
                              <span style={{ fontSize: 10, color: T.muted, fontFamily: T.body }}>{issue.message}</span>
                            </div>
                            <button onClick={() => onNavigate(2)} style={{ background: issue.type === "spike" ? "#e8c84a22" : T.warnDim, border: `1px solid ${issue.type === "spike" ? "#e8c84a88" : T.warn + "88"}`, color: issue.type === "spike" ? "#e8c84a" : T.warn, borderRadius: 5, padding: "3px 10px", fontSize: 10, fontFamily: T.font, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                              REVIEW
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                    <button onClick={() => onNavigate(2)} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontFamily: T.font, fontWeight: 600, cursor: "pointer", textAlign: "left", padding: "4px 0" }}>View all menu items →</button>
                  </div>}
            </>
          )}
        </div>

        {/* Charts — right column stacked */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Menu Item Margins bar chart */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 12 }}>Menu Item Margins</div>
            {marginData.length > 0 ? (
              <ResponsiveContainer width="100%" height={isMobile ? 120 : 140}>
                <BarChart data={marginData}>
                  <XAxis dataKey="name" tick={{ fill: T.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: T.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, fontFamily: T.body, fontSize: 11 }} formatter={(v) => [`${v}%`, "Margin"]} />
                  <Bar dataKey="margin" radius={[3, 3, 0, 0]}>
                    {marginData.map((entry, i) => (<Cell key={i} fill={entry.margin > 60 ? T.accent : entry.margin > 40 ? "#e8c84a" : T.warn} opacity={0.9} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 12, fontFamily: T.body }}>Add menu items to see chart</div>}
          </div>

          {/* Price History line chart */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body }}>Price History</div>
              {ingredientNames.length > 0 && (
                <select value={selectedIngredient} onChange={e => setSelectedIngredient(e.target.value)}
                  style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 5, padding: "3px 8px", color: T.text, fontSize: 11, fontFamily: T.body, outline: "none" }}>
                  {ingredientNames.map(n => <option key={n} value={n}>{n.slice(0, 24)}</option>)}
                </select>
              )}
            </div>
            {priceHistory.length < 2
              ? <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {priceHistory.length === 1
                    ? <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 22, color: T.accent, fontFamily: T.font, fontWeight: 800 }}>${priceHistory[0].price}</div>
                        <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, marginTop: 4 }}>Scan another invoice to see trend</div>
                      </div>
                    : <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>No data yet</div>}
                </div>
              : <ResponsiveContainer width="100%" height={isMobile ? 100 : 120}>
                  <LineChart data={priceHistory}>
                    <XAxis dataKey="date" tick={{ fill: T.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: T.muted, fontSize: 9 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                    <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, fontFamily: T.body, fontSize: 11 }} formatter={(v) => [`$${Number(v).toFixed(2)}`, "Price"]} />
                    <Line type="monotone" dataKey="price" stroke={T.accent} strokeWidth={2} dot={{ fill: T.accent, r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>}
          </div>
        </div>
      </div>
    </div>
  );
}
// ─── Ingredients ──────────────────────────────────────────────────────────────
// ─── Supplies Section ─────────────────────────────────────────────────────────
function SuppliesSection({ items, renderRow }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
      <button onClick={() => setExpanded(e => !e)} style={{ width: "100%", background: "none", border: "none", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15 }}>🧹</span>
          <div style={{ fontSize: 13, color: T.muted, fontFamily: T.font, fontWeight: 700 }}>Supplies & Non-Food Items</div>
          <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, background: T.border, borderRadius: 10, padding: "2px 8px" }}>{items.length}</div>
        </div>
        <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>{expanded ? "▲ collapse" : "▼ show"}</div>
      </button>
      {expanded && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, marginBottom: 8, padding: "8px 4px", borderTop: `1px solid ${T.border}` }}>
            These items are excluded from recipe costing and menu margins
          </div>
          {items.map(renderRow)}
        </div>
      )}
    </div>
  );
}

function IngredientsView({ ingredients, setIngredients, userId, userEmail, menuItems, onPriceChange, aliases, setAliases, ingredientProfiles, setIngredientProfiles }) {
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
    // Find the ingredient before deleting so we can clean up supplier_pricing too
    const ing = ingredients.find(i => i.id === id);
    await supabase.from("ingredients").delete().eq("id", id);
    // Also remove from supplier_pricing if it was crowdsourced from this entry
    if (ing?.name && ing?.supplier && ing?.price) {
      await supabase.from("supplier_pricing")
        .delete()
        .eq("supplier_name", ing.supplier)
        .eq("ingredient_name", ing.name)
        .eq("case_price", ing.price);
    }
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
    const rows = items.map((r) => ({
      name: r.name,
      supplier: r.supplier,
      date: r.date,
      price: r.price,
      case_size: r.case_size || null,
      case_unit: r.case_unit || r.unit,
      unit: r.unit,
      user_id: userId,
      is_supply: detectIsSupply(r.name),
    }));
    const { data, error } = await supabase.from("ingredients").insert(rows).select();
    if (!error) {
      // Crowdsource: anonymously write pricing data to supplier_pricing for swap recommendations
      // Only write items with a supplier name and valid case_size so unit_price auto-calculates
      // Outlier protection: skip entries where unit price is more than 10x the median of existing prices for same ingredient
      const isOutlierPrice = (name, casePrice, caseSize) => {
        if (!caseSize || caseSize <= 0) return true;
        const unitPrice = casePrice / caseSize;
        const existing = ingredients
          .filter(i => normalizeNameForGrouping(i.name) === normalizeNameForGrouping(name) && i.case_size > 0)
          .map(i => i.price / i.case_size)
          .filter(p => p > 0);
        if (existing.length < 2) return false; // not enough data to detect outlier
        const median = existing.sort((a, b) => a - b)[Math.floor(existing.length / 2)];
        return unitPrice > median * 10 || unitPrice < median * 0.1; // flag if 10x above or below median
      };

      const crowdsourceRows = items
        .filter(r => r.supplier && r.price && r.case_size && r.case_size > 0)
        .filter(r => !isOutlierPrice(r.name, r.price, r.case_size)) // skip outlier prices
        .map(r => ({
          supplier_name: r.supplier,
          supplier_type: ["Sysco", "US Foods", "Performance Food Group", "Restaurant Depot", "PFG"].includes(r.supplier) ? "national" : "local",
          state_code: ["Sysco", "US Foods", "Performance Food Group", "Restaurant Depot", "PFG"].includes(r.supplier) ? "NATIONAL" : (profile?.state || "UNKNOWN"),
          ingredient_name: r.name,
          case_price: r.price,
          case_size: r.case_size,
          case_unit: r.case_unit || r.unit,
          website: null,
          region: ["Sysco", "US Foods", "Performance Food Group", "Restaurant Depot", "PFG"].includes(r.supplier) ? "NATIONAL" : (profile?.state || "UNKNOWN"),
          last_updated: new Date().toISOString().split("T")[0],
        }));
      if (crowdsourceRows.length > 0) {
        supabase.from("supplier_pricing").insert(crowdsourceRows).then(() => {}); // fire and forget
      }
      const newIngredients = [...ingredients, ...data];
      setIngredients(newIngredients);
      const changes = [];
      items.filter(item => !item.is_supply).forEach(item => {
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

      // Update ingredient profiles — use RPC to properly increment scan_count and roll avg_price
      if (userId && setIngredientProfiles) {
        Promise.all(items.map(r =>
          supabase.rpc("upsert_ingredient_profile", {
            p_user_id: userId,
            p_canonical_name: r.name,
            p_supplier: r.supplier || null,
            p_price: r.price,
            p_last_seen: r.date || today(),
            p_case_unit: r.case_unit || r.unit,
            p_is_supply: detectIsSupply(r.name),
          })
        )).then(() => {
          // Reload profiles after update
          supabase.from("user_ingredient_profiles")
            .select("*").eq("user_id", userId)
            .then(({ data }) => { if (data && setIngredientProfiles) setIngredientProfiles(data); });
        });
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
        const foodIngredients = ingredients.filter(i => !i.is_supply);
        const supplyItems = ingredients.filter(i => i.is_supply);

        const buildGrouped = (items) => {
          const grouped = {};
          items.forEach(ing => {
            const key = ing.date || "Unknown Date";
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(ing);
          });
          const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
          sortedDates.forEach(date => { grouped[date].sort((a, b) => a.name.localeCompare(b.name)); });
          return { grouped, sortedDates };
        };

        const renderIngredientRow = (ing) => {
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
        };

        const { grouped: foodGrouped, sortedDates: foodDates } = buildGrouped(foodIngredients);

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Food ingredients — main section */}
            {foodDates.map(date => (
              <div key={date}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: T.accent, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, fontWeight: 600 }}>📄 {date}</div>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                  <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>{foodGrouped[date].length} items · {foodGrouped[date][0]?.supplier || ""}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {foodGrouped[date].map(renderIngredientRow)}
                </div>
              </div>
            ))}

            {/* Supplies — collapsed section at bottom */}
            {supplyItems.length > 0 && (
              <SuppliesSection items={supplyItems} onEdit={openEdit} onDelete={(id) => setConfirmDeleteId(id)} confirmDeleteId={confirmDeleteId} onConfirmDelete={del} onCancelDelete={() => setConfirmDeleteId(null)} renderRow={renderIngredientRow} />
            )}
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

      {showScanner && <InvoiceScanner onIngredientsFound={handleScanned} onClose={() => setShowScanner(false)} userId={userId} ingredientProfiles={ingredientProfiles} onAliasSaved={(newAliases) => setAliases && setAliases(prev => [...prev.filter(a => !newAliases.find(n => n.raw_name === a.raw_name)), ...newAliases])} />}

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
      const enhanced = await enhanceInvoiceImage(imageBase64);
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
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: enhanced } },
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
function MenuView({ menuItems, setMenuItems, ingredients, userId, session, profile, aliases = [] }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", salePrice: "", ingredients: [{ ingredient_name: "", qty: "", qty_unit: "oz" }] });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showMenuScanner, setShowMenuScanner] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuestions, setAiQuestions] = useState([]);
  const [aiAnswers, setAiAnswers] = useState({});
  const [aiPendingSuggestion, setAiPendingSuggestion] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [swapModal, setSwapModal] = useState(null); // { ingredientName, currentCost }
  const [swapResults, setSwapResults] = useState([]);
  const [swapLoading, setSwapLoading] = useState(false);

  // Deduplicated food ingredient list — excludes supplies, one entry per unique name, most recent price
  const uniqueIngredients = Object.values(
    ingredients
      .filter(ing => !ing.is_supply) // never show supplies in recipe builder
      .reduce((acc, ing) => {
        const key = ing.name.toLowerCase();
        if (!acc[key] || new Date(ing.date) > new Date(acc[key].date)) acc[key] = ing;
        return acc;
      }, {})
  ).sort((a, b) => a.name.localeCompare(b.name));

  const [skippedDupes, setSkippedDupes] = useState(0);

  const openSwap = async (ingredientName, currentCost) => {
    setSwapModal({ ingredientName, currentCost });
    setSwapResults([]);
    setSwapLoading(true);
    try {
      // Find the ingredient's case_unit for unit compatibility filtering
      const ing = ingredients.find(i => i.name.toLowerCase() === ingredientName.toLowerCase());
      const caseUnit = ing?.case_unit || ing?.unit || null;
      const { data } = await supabase.rpc("find_swap_alternatives", {
        p_ingredient_name: ingredientName,
        p_case_unit: caseUnit,
        p_state_code: profile?.state || null,
        p_limit: 8,
      });
      setSwapResults(data || []);
    } catch (e) {
      console.error("Swap error:", e);
    } finally {
      setSwapLoading(false);
    }
  };

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
                          onClick={() => openSwap(biggestIngredient.ingredient_name, biggestIngredient.cost)}
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

      {/* ── Supplier Swap Modal ── */}
      {swapModal && (
        <Modal title="Find Better Price" onClose={() => setSwapModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, lineHeight: 1.6 }}>
              Looking for cheaper alternatives to <strong style={{ color: T.text }}>{swapModal.ingredientName}</strong>.
              Your current cost is <strong style={{ color: T.warn }}>{fmt$2(swapModal.currentCost)}/serving</strong>.
            </div>

            {swapLoading && (
              <div style={{ textAlign: "center", padding: "24px 0", color: T.muted, fontFamily: T.body, fontSize: 13 }}>
                Searching supplier database...
              </div>
            )}

            {!swapLoading && swapResults.length === 0 && (
              <div style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 10, padding: "20px", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, lineHeight: 1.6 }}>
                  No alternatives found in our database yet for this ingredient.
                  As more restaurants scan invoices, we'll build up alternatives automatically.
                </div>
              </div>
            )}

            {!swapLoading && swapResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {swapResults.length} alternative{swapResults.length > 1 ? "s" : ""} found
                </div>
                {swapResults.map((r, i) => {
                  const savings = swapModal.currentCost - r.unit_price;
                  const isCheaper = savings > 0;
                  return (
                    <div key={i} style={{ background: isCheaper ? T.accentDim : T.faint, border: `1px solid ${isCheaper ? T.accentMid : T.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 3 }}>{r.supplier_name}</div>
                        <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>
                          {fmt$2(r.unit_price)}/{r.case_unit || "unit"} · {r.supplier_type === "national" || r.state_code === "NATIONAL" ? "National supplier" : `Local · ${r.state_code}`}
                        </div>
                        {isCheaper && (
                          <div style={{ fontSize: 12, color: T.accent, fontFamily: T.body, marginTop: 4, fontWeight: 600 }}>
                            Save {fmt$2(Math.abs(savings))}/unit vs what you're paying
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                        {r.website ? (
                          <a href={r.website} target="_blank" rel="noopener noreferrer"
                            style={{ background: T.accent, color: "#0a0d0a", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontFamily: T.font, fontWeight: 700, cursor: "pointer", textDecoration: "none", textAlign: "center" }}>
                            Visit Supplier →
                          </a>
                        ) : (
                          <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>No website on file</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, borderTop: `1px solid ${T.border}`, paddingTop: 12, lineHeight: 1.5 }}>
              Prices are sourced from other KitchenIQ restaurants and may vary. Always confirm current pricing directly with the supplier.
            </div>
          </div>
        </Modal>
      )}

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

// ─── Price Alerts + Supplier Swap ─────────────────────────────────────────────
function AlertsView({ ingredients, session, profile }) {
  const alerts = getPriceAlerts(ingredients.filter(i => !i.is_supply));
  const [swapModal, setSwapModal] = useState(null); // { name, newPrice }
  const [swapResults, setSwapResults] = useState([]);
  const [swapLoading, setSwapLoading] = useState(false);

  const openSwapModal = async (alert) => {
    setSwapModal(alert);
    setSwapResults([]);
    setSwapLoading(true);
    try {
      const { data } = await supabase.rpc("find_swap_alternatives", {
        p_ingredient_name: alert.name,
        p_case_unit: alert.unit || null,
        p_state_code: profile?.state || null,
        p_limit: 8,
      });
      setSwapResults(data || []);
    } catch (e) {
      console.error("Swap fetch error:", e);
    } finally {
      setSwapLoading(false);
    }
  };

  const handleAcceptSwap = async (swap) => {
    if (session && swapModal) {
      await supabase.from("swap_requests").insert({
        user_id: session.user.id,
        ingredient_name: swapModal.name,
        current_supplier: "Current Supplier",
        current_unit_price: swapModal.newPrice,
        suggested_supplier_name: swap.supplier_name,
        suggested_supplier_website: swap.website,
        suggested_unit_price: swap.unit_price,
        status: "accepted",
      });
    }
  };

  return (
    <div>
      <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 20 }}>
        {alerts.length} price changes detected
      </div>

      {alerts.length === 0
        ? <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 40, textAlign: "center", color: T.muted, fontFamily: T.body }}>
            No price changes yet. You need at least 2 entries for the same ingredient.
          </div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map((a, i) => (
              <div key={i} style={{ background: T.card, border: `1px solid ${a.pct > 0 ? T.warn + "55" : T.accentMid}`, borderRadius: 10, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 15, color: T.text, fontFamily: T.font, fontWeight: 600 }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 4 }}>
                    {fmt$2(a.oldPrice)} → {fmt$2(a.newPrice)} · {a.unit} · {a.date}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  {a.pct > 0 && (
                    <button
                      onClick={() => openSwapModal(a)}
                      style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, color: T.accent, borderRadius: 6, padding: "7px 13px", fontSize: 11, fontFamily: T.font, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                      Find Better Price →
                    </button>
                  )}
                  <div style={{ fontSize: 22, fontFamily: T.font, fontWeight: 800, color: a.pct > 0 ? T.warn : T.accent, minWidth: 80, textAlign: "right" }}>
                    {a.pct > 0 ? "▲" : "▼"} {Math.abs(a.pct).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
      }

      {/* ── Supplier Swap Modal ── */}
      {swapModal && (
        <Modal title="Find Better Price" onClose={() => { setSwapModal(null); setSwapResults([]); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, lineHeight: 1.6 }}>
              Finding cheaper alternatives to <strong style={{ color: T.text }}>{swapModal.name}</strong>.
              You're currently paying <strong style={{ color: T.warn }}>{fmt$2(swapModal.newPrice)}/{swapModal.unit || "unit"}</strong>.
            </div>

            {swapLoading && (
              <div style={{ textAlign: "center", padding: "24px 0", color: T.muted, fontFamily: T.body, fontSize: 13 }}>
                Searching supplier database...
              </div>
            )}

            {!swapLoading && swapResults.length === 0 && (
              <div style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 10, padding: "24px", textAlign: "center" }}>
                <div style={{ fontSize: 22, marginBottom: 10 }}>🔍</div>
                <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, lineHeight: 1.6 }}>
                  No alternatives found yet for this ingredient.<br />
                  As more restaurants scan invoices, alternatives build up automatically.
                </div>
              </div>
            )}

            {!swapLoading && swapResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {swapResults.length} supplier{swapResults.length > 1 ? "s" : ""} found
                </div>
                {swapResults.map((r, i) => {
                  const savings = swapModal.newPrice - r.unit_price;
                  const isCheaper = savings > 0;
                  return (
                    <div key={i} style={{ background: isCheaper ? T.accentDim : T.faint, border: `1px solid ${isCheaper ? T.accentMid : T.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 700, marginBottom: 3 }}>{r.supplier_name}</div>
                        <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>
                          {fmt$2(r.unit_price)}/{r.case_unit || "unit"} · {r.state_code === "NATIONAL" ? "National supplier" : `Local · ${r.state_code}`}
                        </div>
                        {isCheaper && (
                          <div style={{ fontSize: 12, color: T.accent, fontFamily: T.body, marginTop: 4, fontWeight: 600 }}>
                            Save {fmt$2(Math.abs(savings))}/unit vs what you're paying
                          </div>
                        )}
                        {!isCheaper && (
                          <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 4 }}>
                            Higher than your current price
                          </div>
                        )}
                      </div>
                      {r.website && (
                        <a href={r.website} target="_blank" rel="noopener noreferrer"
                          onClick={() => handleAcceptSwap(r)}
                          style={{ background: isCheaper ? T.accent : T.faint, color: isCheaper ? "#0a0d0a" : T.muted, border: isCheaper ? "none" : `1px solid ${T.border}`, borderRadius: 6, padding: "8px 14px", fontSize: 12, fontFamily: T.font, fontWeight: 700, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
                          Visit →
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, borderTop: `1px solid ${T.border}`, paddingTop: 12, lineHeight: 1.5 }}>
              Prices sourced from other KitchenIQ restaurants and may vary. Always confirm pricing directly with the supplier.
            </div>
          </div>
        </Modal>
      )}
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
// ─── Demo Screen ──────────────────────────────────────────────────────────────
function DemoScreen({ onSignUp, onLogin, onBack }) {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [scanStage, setScanStage] = useState("idle"); // idle | viewfinder | flash | scanning | results
  const [scanItems, setScanItems] = useState([]);
  const [tourStep, setTourStep] = useState(0);
  const [flashCard, setFlashCard] = useState(null);
  const [liveAlertVisible, setLiveAlertVisible] = useState(false);
  const [chartOpacity, setChartOpacity] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 80);
    setTimeout(() => setTourStep(1), 700);
    setTimeout(() => setChartOpacity(1), 500);
    setTimeout(() => setLiveAlertVisible(true), 4000);
    setTimeout(() => setLiveAlertVisible(false), 8500);
    const cards = ["ingredients", "menu", "margin", "alerts"];
    let cardIdx = 0;
    const cardFlash = setInterval(() => {
      setFlashCard(cards[cardIdx % cards.length]);
      cardIdx++;
      setTimeout(() => setFlashCard(null), 900);
    }, 3500);
    const iv = setInterval(() => setPulse(p => !p), 2200);
    return () => { clearInterval(iv); clearInterval(cardFlash); };
  }, []);

  const [tourStepDone, setTourStepDone] = useState(false);
  const [demoScanCompleted, setDemoScanCompleted] = useState(false);

  const TOUR_STEPS = [
    { tab: 0, text: "👋 This is your Dashboard — margins and price alerts at a glance.", action: null },
    { tab: 1, text: "📸 Tap 'Scan Invoice' — AI reads your invoice automatically. Try it!", action: "scan" },
    { tab: 3, text: "⚡ Every price change shows up here with exact dollar impact per dish.", action: null },
    { tab: 2, text: "🍽 Your real food cost % on every dish — updates automatically.", action: null },
  ];
  const currentTour = TOUR_STEPS[tourStep - 1];

  useEffect(() => {
    if (!currentTour) return;
    if (!currentTour.action) setTourStepDone(true);
    else setTourStepDone(false);
  }, [tourStep]);

  useEffect(() => {
    if (tourStep === 2 && demoScanCompleted) setTourStepDone(true);
  }, [demoScanCompleted, tourStep]);

  const startDemoScan = () => {
    if (scanStage !== "idle") return;
    setScanItems([]);
    setScanStage("viewfinder");
    setTimeout(() => setScanStage("flash"), 1200);
    setTimeout(() => setScanStage("scanning"), 1450);
    setTimeout(() => {
      setScanStage("results");
      DEMO_SCAN_ITEMS.forEach((item, i) => {
        setTimeout(() => {
          setScanItems(prev => {
            const next = [...prev, item];
            if (next.length === DEMO_SCAN_ITEMS.length) setDemoScanCompleted(true);
            return next;
          });
        }, i * 350);
      });
    }, 3000);
  };

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

  const fadeIn = (delay = 0) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(18px)",
    transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
  });

  // Phone dimensions — iPhone 15 proportions
  const phoneW = isMobile ? Math.min(window.innerWidth - 32, 340) : 340;
  const phoneH = Math.round(phoneW * 2.16); // iPhone 15 aspect ratio
  const innerW = phoneW - 20; // 10px bezel each side
  const innerH = phoneH - 80; // top/bottom bezel

  // Phone app content scaled to fit
  const DEMO_TABS = ["Dashboard", "Ingredients", "Menu Items", "Alerts"];
  const DEMO_TAB_ICONS = ["◈", "📦", "🍽", "⚡"];

  const phoneContent = (
    <div style={{ width: innerW, height: innerH, background: T.bg, overflowY: "auto", overflowX: "hidden", fontFamily: T.body }}>
      {/* Phone status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: T.text, fontFamily: T.font, fontWeight: 700 }}>9:41</div>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <div style={{ fontSize: 9, color: T.text }}>●●●●</div>
          <div style={{ fontSize: 9, color: T.text }}>WiFi</div>
          <div style={{ fontSize: 9, color: T.text }}>🔋</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, background: T.card, flexShrink: 0 }}>
        {DEMO_TABS.map((t, i) => {
          const alertCount = i === 3 ? getPriceAlerts(DEMO_INGREDIENTS).length : 0;
          return (
            <button key={i} onClick={() => setTab(i)} style={{
              flex: 1, background: "none", border: "none",
              borderBottom: `2px solid ${tab === i ? T.accent : "transparent"}`,
              color: tab === i ? T.accent : T.muted,
              padding: "10px 2px 8px", fontSize: 9, fontFamily: T.font, fontWeight: 600,
              cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}>
              <span style={{ fontSize: 14 }}>{DEMO_TAB_ICONS[i]}</span>
              <span>{t}</span>
              {alertCount > 0 && <span style={{ background: T.warn, color: "#fff", borderRadius: 8, fontSize: 8, padding: "1px 4px", fontFamily: T.font, fontWeight: 700 }}>{alertCount}</span>}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ padding: "12px 10px", flex: 1 }}>
        {tab === 0 && (
          <div>
            <style>{`
              @keyframes cardFlash { 0% { border-color: #1e2b1f; } 50% { border-color: #4eca6e; box-shadow: 0 0 12px #4eca6e22; } 100% { border-color: #1e2b1f; } }
              @keyframes toastSlide { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
              @keyframes tourPulse { 0%,100% { box-shadow: 0 0 0 0 #4eca6e33; } 50% { box-shadow: 0 0 0 8px #4eca6e00; } }
            `}</style>

            {/* Subtle toast pill — not a full alert box */}
            {liveAlertVisible && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.faint, border: `1px solid ${T.warn}33`, borderRadius: 20, padding: "5px 10px", marginBottom: 10, animation: "toastSlide 0.3s ease" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.warn, flexShrink: 0 }} />
                <div style={{ fontSize: 9, color: T.warn, fontFamily: T.font, fontWeight: 700 }}>Eggs +38%</div>
                <div style={{ fontSize: 9, color: T.muted, fontFamily: T.body }}>$38.40 → $52.80</div>
              </div>
            )}

            {/* Lean stat cards — no full Dashboard component */}
            {(() => {
              const demoAlerts = getPriceAlerts(DEMO_INGREDIENTS);
              const demoStats = DEMO_MENU_ITEMS.map(m => calcMenuStats(m, DEMO_INGREDIENTS));
              const avgMargin = demoStats.length ? demoStats.reduce((s, m) => s + m.margin, 0) / demoStats.length : 0;
              const cards = [
                { key: "ingredients", label: "Tracked", value: DEMO_INGREDIENTS.length, accent: true },
                { key: "menu", label: "Menu Items", value: DEMO_MENU_ITEMS.length },
                { key: "margin", label: "Avg Margin", value: fmtPct(avgMargin), accent: avgMargin > 60, warn: avgMargin < 50 },
                { key: "alerts", label: "Alerts", value: demoAlerts.length, warn: demoAlerts.length > 0, accent: demoAlerts.length === 0 },
              ];
              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
                  {cards.map(card => (
                    <div key={card.key} style={{
                      background: T.card,
                      border: `1px solid ${card.warn ? T.warn + "55" : card.accent ? T.accentMid : T.border}`,
                      borderRadius: 8, padding: "10px 10px",
                      animation: flashCard === card.key ? "cardFlash 0.9s ease" : "none",
                    }}>
                      <div style={{ fontSize: 8, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 4 }}>{card.label}</div>
                      <div style={{ fontSize: 20, color: card.warn ? T.warn : card.accent ? T.accent : T.text, fontFamily: T.font, fontWeight: 800, lineHeight: 1 }}>{card.value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Mini price history sparkline */}
            {(() => {
              const alerts = getPriceAlerts(DEMO_INGREDIENTS);
              if (!alerts.length) return null;
              return (
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 8 }}>Recent Price Changes</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {alerts.slice(0, 3).map((a, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 10, color: T.text, fontFamily: T.font, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{a.name}</div>
                        <div style={{ fontSize: 10, color: a.pct > 0 ? T.warn : T.accent, fontFamily: T.font, fontWeight: 700, flexShrink: 0 }}>{a.pct > 0 ? "+" : ""}{a.pct.toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
        {tab === 1 && (
          <div>
            <style>{`
              @keyframes scanLine { 0% { top: 0%; } 100% { top: 100%; } }
              @keyframes flashFade { 0% { opacity: 0; } 20% { opacity: 1; } 100% { opacity: 0; } }
              @keyframes progressBar { from { width: 0%; } to { width: 100%; } }
              @keyframes itemPop { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>

            {/* Viewfinder stage — camera looking at invoice */}
            {(scanStage === "viewfinder" || scanStage === "flash") && (
              <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#000", height: 240 }}>
                {/* Fake invoice background */}
                <div style={{ position: "absolute", inset: 0, background: "#f8f6f0", display: "flex", flexDirection: "column", gap: 0 }}>
                  {/* Fake invoice header */}
                  <div style={{ background: "#1a3a5c", padding: "8px 12px" }}>
                    <div style={{ fontSize: 10, color: "#fff", fontFamily: "monospace", fontWeight: 700 }}>SYSCO</div>
                    <div style={{ fontSize: 7, color: "#aac", fontFamily: "monospace" }}>Invoice #8841029 · Apr 16 2026</div>
                  </div>
                  {/* Fake invoice rows */}
                  {["BACON LAYOUT APWD 15LB........$68.89", "EGGS SHELL LG GR AA 180CT.....$32.63", "CHEESE CHDR JCK SHRD 20LB.....$51.55", "PANCAKE MIX CMPL 30LB.........$57.95", "CREAMER H&H 384EA.............$24.95", "BUTTER SOLID USDA AA 36LB....$114.45", "POTATO RED A SZ 50LB..........$22.95"].map((row, i) => (
                    <div key={i} style={{ padding: "3px 12px", borderBottom: "1px solid #e8e4dc", fontSize: 7, color: "#333", fontFamily: "monospace", lineHeight: 1.6 }}>{row}</div>
                  ))}
                </div>

                {/* Camera UI overlay */}
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)" }}>
                  {/* Corner brackets */}
                  <div style={{ position: "absolute", top: 12, left: 12, width: 16, height: 16, borderTop: "2px solid #4eca6e", borderLeft: "2px solid #4eca6e" }} />
                  <div style={{ position: "absolute", top: 12, right: 12, width: 16, height: 16, borderTop: "2px solid #4eca6e", borderRight: "2px solid #4eca6e" }} />
                  <div style={{ position: "absolute", bottom: 12, left: 12, width: 16, height: 16, borderBottom: "2px solid #4eca6e", borderLeft: "2px solid #4eca6e" }} />
                  <div style={{ position: "absolute", bottom: 12, right: 12, width: 16, height: 16, borderBottom: "2px solid #4eca6e", borderRight: "2px solid #4eca6e" }} />
                  {/* Scanning line */}
                  {scanStage === "viewfinder" && (
                    <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${T.accent}, transparent)`, animation: "scanLine 1.2s ease-in-out", boxShadow: `0 0 8px ${T.accent}` }} />
                  )}
                </div>

                {/* Flash overlay */}
                {scanStage === "flash" && (
                  <div style={{ position: "absolute", inset: 0, background: "#fff", animation: "flashFade 0.25s ease-out forwards" }} />
                )}

                {/* Camera shutter label */}
                <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#fff", fontFamily: T.body, opacity: 0.8, textShadow: "0 1px 2px #000" }}>📸 Scanning invoice...</div>
                </div>
              </div>
            )}

            {/* Scanning stage — AI processing */}
            {scanStage === "scanning" && (
              <div style={{ padding: "24px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>🤖</div>
                <div style={{ fontSize: 12, color: T.accent, fontFamily: T.font, fontWeight: 700, marginBottom: 4 }}>AI reading invoice...</div>
                <div style={{ fontSize: 10, color: T.muted, fontFamily: T.body, marginBottom: 16 }}>Identifying ingredients, prices, case sizes</div>
                <div style={{ height: 3, background: T.faint, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: T.accent, borderRadius: 2, animation: "progressBar 1.6s ease-in-out forwards" }} />
                </div>
              </div>
            )}

            {/* Results stage — items pop in */}
            {scanStage === "results" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: T.accent, fontFamily: T.font, fontWeight: 700 }}>✓ {scanItems.length}/{DEMO_SCAN_ITEMS.length} items extracted</div>
                  <button onClick={() => { setScanStage("idle"); setScanItems([]); }} style={{ background: "none", border: "none", color: T.muted, fontSize: 9, fontFamily: T.body, cursor: "pointer", textDecoration: "underline" }}>Reset</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {scanItems.map((item, i) => (
                    <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", animation: "itemPop 0.3s ease" }}>
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <div style={{ fontSize: 10, color: T.text, fontFamily: T.font, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                        <div style={{ fontSize: 8, color: T.muted, fontFamily: T.body }}>{item.case_size}{item.case_unit}</div>
                      </div>
                      <div style={{ fontSize: 11, color: T.accent, fontFamily: T.font, fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>${item.price.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
                {scanItems.length === DEMO_SCAN_ITEMS.length && (
                  <div style={{ marginTop: 8, background: T.warnDim, border: `1px solid ${T.warn}33`, borderRadius: 7, padding: "8px 10px" }}>
                    <div style={{ fontSize: 9, color: T.warn, fontFamily: T.font, fontWeight: 700 }}>⚡ 2 price changes detected</div>
                    <div style={{ fontSize: 8, color: T.muted, fontFamily: T.body, marginTop: 2 }}>Bacon +16% · Eggs +38%</div>
                  </div>
                )}
              </div>
            )}

            {/* Idle stage — show existing ingredients + scan button */}
            {scanStage === "idle" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: T.body }}>{DEMO_INGREDIENTS.length} tracked</div>
                  <button onClick={startDemoScan} style={{ background: `linear-gradient(135deg, #4eca6e22, #6e4eca22)`, border: `1px solid ${T.accentMid}`, color: T.accent, borderRadius: 6, padding: "7px 12px", fontSize: 10, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>📸 Scan Invoice</button>
                </div>
                {(() => {
                  const grouped = {};
                  DEMO_INGREDIENTS.forEach(ing => {
                    const key = ing.date || "Unknown";
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(ing);
                  });
                  return Object.keys(grouped).sort((a,b) => new Date(b)-new Date(a)).map(date => (
                    <div key={date} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 9, color: T.accent, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: T.body, fontWeight: 600, marginBottom: 6 }}>📄 {date}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {grouped[date].sort((a,b) => a.name.localeCompare(b.name)).map(ing => {
                          const uc = getUnitCost(ing);
                          return (
                            <div key={ing.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontSize: 11, color: T.text, fontFamily: T.font, fontWeight: 600 }}>{ing.name}</div>
                                <div style={{ fontSize: 9, color: T.muted, fontFamily: T.body }}>{ing.case_size} {ing.case_unit}</div>
                                {uc && <div style={{ fontSize: 9, color: T.accent }}>${uc.toFixed(3)}/{ing.case_unit}</div>}
                              </div>
                              <div style={{ fontSize: 13, color: T.accent, fontFamily: T.font, fontWeight: 700 }}>{fmt$2(ing.price)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        )}
        {tab === 2 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: T.body }}>{DEMO_MENU_ITEMS.length} menu items</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {DEMO_MENU_ITEMS.map(m => {
                const { cost, profit, margin } = calcMenuStats(m, DEMO_INGREDIENTS);
                const color = margin > 65 ? T.accent : margin > 50 ? "#e8c84a" : T.warn;
                return (
                  <div key={m.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 11, color: T.text, fontFamily: T.font, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{m.name}</div>
                      <div style={{ fontSize: 18, color, fontFamily: T.font, fontWeight: 800, flexShrink: 0 }}>{fmtPct(margin)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${T.faint}` }}>
                      <span style={{ fontSize: 9, color: T.muted }}>Sale: <strong style={{ color: T.text }}>{fmt$2(m.sale_price)}</strong></span>
                      <span style={{ fontSize: 9, color: T.muted }}>Cost: <strong style={{ color: T.text }}>{fmt$2(cost)}</strong></span>
                      <span style={{ fontSize: 9, color: T.muted }}>Profit: <strong style={{ color }}>{fmt$2(profit)}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {tab === 3 && (
          <div>
            <div style={{ fontSize: 9, color: T.muted, fontFamily: T.body, marginBottom: 10, lineHeight: 1.5, opacity: 0.8 }}>
              Jan → Feb price changes the sample restaurant never noticed. Margins dropped silently for weeks.
            </div>
            <AlertsView ingredients={DEMO_INGREDIENTS} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: T.bg, fontFamily: T.body, color: T.text, boxSizing: "border-box", overflowX: "hidden" }}>
      <style>{`
        @keyframes phoneGlow { 0%,100% { box-shadow: 0 0 40px #4eca6e18, 0 40px 80px #00000066; } 50% { box-shadow: 0 0 60px #4eca6e28, 0 40px 80px #00000066; } }
        @keyframes tourPulse { 0%,100% { box-shadow: 0 0 0 0 #4eca6e22; } 50% { box-shadow: 0 0 0 10px #4eca6e00; } }
      `}</style>

      {/* ── NAV — matches landing page exactly ── */}
      <nav style={{ borderBottom: `1px solid ${T.border}`, background: "rgba(10,13,10,0.94)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ padding: `0 ${isMobile ? "20px" : "6%"}`, display: "flex", alignItems: "center", justifyContent: "space-between", height: isMobile ? 56 : 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            {onBack && (
              <button onClick={onBack} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, fontFamily: T.body, cursor: "pointer", marginRight: 4, padding: 0 }}>←</button>
            )}
            <div style={{ width: 32, height: 32, borderRadius: 8, background: T.accentDim, border: `1.5px solid ${T.accentMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⬡</div>
            <span style={{ fontFamily: T.font, fontWeight: 800, fontSize: isMobile ? 17 : 19, color: T.text, letterSpacing: "-0.01em" }}>Kitchen<span style={{ color: T.accent }}>IQ</span></span>
            <span style={{ fontSize: 10, background: T.warnDim, color: T.warn, border: `1px solid ${T.warn}33`, borderRadius: 4, padding: "2px 7px", fontFamily: T.font, fontWeight: 700, letterSpacing: "0.05em" }}>DEMO</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!isMobile && <button onClick={onLogin} style={{ background: "transparent", border: "none", color: T.muted, fontSize: 14, fontFamily: T.body, fontWeight: 500, cursor: "pointer", padding: "8px 14px" }}>Log in</button>}
            <button onClick={onSignUp} style={{ background: T.accent, color: "#0a0d0a", border: "none", borderRadius: 7, padding: isMobile ? "8px 14px" : "9px 20px", fontSize: 13, fontFamily: T.font, fontWeight: 700, cursor: "pointer" }}>
              {isMobile ? "Free trial" : "Start free trial →"}
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO TEXT ── */}
      <div style={{ textAlign: "center", padding: isMobile ? "40px 20px 24px" : "64px 32px 32px", ...fadeIn(0) }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: T.warnDim, border: `1px solid ${T.warn}33`, borderRadius: 100, padding: "5px 14px", marginBottom: 20 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.warn, opacity: pulse ? 1 : 0.45, transition: "opacity 0.6s" }} />
          <span style={{ fontSize: 11, color: T.warn, fontFamily: T.font, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Interactive demo</span>
        </div>
        <h1 className="landing-h1" style={{ marginBottom: 10, fontSize: isMobile ? 28 : 40 }}>See it working on a real restaurant</h1>
        <p className="landing-body" style={{ fontSize: isMobile ? 14 : 16, maxWidth: 520, margin: "0 auto 8px", color: T.muted }}>
          Live data, real invoices, actual food cost calculations. Follow the guided tour or explore on your own.
        </p>
      </div>

      {/* ── PHONE + TOUR LAYOUT ── */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        gap: isMobile ? 0 : 48,
        padding: isMobile ? "0 16px 40px" : "0 6% 80px",
        flexDirection: isMobile ? "column" : "row",
        ...fadeIn(150),
      }}>

        {/* Tour panel — left on desktop */}
        {!isMobile && tourStep > 0 && currentTour && (
          <div style={{
            width: 220, flexShrink: 0, position: "sticky", top: 100,
            background: "#0c160d", border: `1.5px solid ${T.accentMid}`,
            borderRadius: 16, padding: "24px 20px",
            boxShadow: "0 8px 40px #000000aa",
            animation: "tourPulse 3s ease-in-out infinite",
            alignSelf: "flex-start",
            marginTop: 40,
          }}>
            <div style={{ fontSize: 10, color: T.accent, fontFamily: T.font, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Guided Tour</div>
            <div style={{ height: 3, background: T.faint, borderRadius: 2, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ height: "100%", background: T.accent, borderRadius: 2, width: `${(tourStep / TOUR_STEPS.length) * 100}%`, transition: "width 0.4s ease" }} />
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {TOUR_STEPS.map((_, i) => (
                <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < tourStep ? T.accent : T.faint, transition: "background 0.3s" }} />
              ))}
            </div>
            <div style={{ fontSize: 14, color: T.text, fontFamily: T.body, lineHeight: 1.7, marginBottom: 16, fontWeight: 500 }}>{currentTour.text}</div>
            {currentTour.action && !tourStepDone && (
              <div style={{ fontSize: 11, color: T.accent, fontFamily: T.body, marginBottom: 14, background: T.accentDim, borderRadius: 6, padding: "8px 10px", border: `1px solid ${T.accentMid}` }}>
                ☝️ Complete the action in the phone first
              </div>
            )}
            <button onClick={nextTour} disabled={!tourStepDone} style={{
              background: tourStepDone ? T.accent : T.faint,
              color: tourStepDone ? "#0f1410" : T.muted,
              border: "none", borderRadius: 8, padding: "11px 16px",
              fontSize: 13, fontFamily: T.font, fontWeight: 800,
              cursor: tourStepDone ? "pointer" : "not-allowed", width: "100%",
              transition: "all 0.2s",
            }}>
              {tourStep < TOUR_STEPS.length ? `Next → Step ${tourStep + 1}` : "Done ✓"}
            </button>
            <button onClick={() => setTourStep(0)} style={{ background: "none", border: "none", color: T.muted, fontSize: 11, fontFamily: T.body, cursor: "pointer", textDecoration: "underline", display: "block", textAlign: "center", width: "100%", marginTop: 10 }}>
              Skip tour
            </button>
          </div>
        )}

        {/* iPhone frame */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{
            width: phoneW,
            height: phoneH,
            background: "#111",
            borderRadius: 44,
            border: "2px solid #333",
            padding: "10px",
            boxSizing: "border-box",
            position: "relative",
            animation: "phoneGlow 4s ease-in-out infinite",
            flexShrink: 0,
          }}>
            {/* Dynamic Island */}
            <div style={{
              position: "absolute",
              top: 12,
              left: "50%",
              transform: "translateX(-50%)",
              width: 110,
              height: 30,
              background: "#000",
              borderRadius: 20,
              zIndex: 10,
            }} />

            {/* Screen */}
            <div style={{
              width: "100%",
              height: "100%",
              borderRadius: 36,
              overflow: "hidden",
              background: T.bg,
              position: "relative",
            }}>
              {phoneContent}
            </div>

            {/* Home indicator */}
            <div style={{
              position: "absolute",
              bottom: 8,
              left: "50%",
              transform: "translateX(-50%)",
              width: 100,
              height: 4,
              background: "#444",
              borderRadius: 2,
            }} />
          </div>

          {/* Sign up nudge below phone */}
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <button onClick={onSignUp} style={{
              background: T.accent, color: "#0a0d0a", border: "none", borderRadius: 8,
              padding: "13px 28px", fontSize: 14, fontFamily: T.font, fontWeight: 700,
              cursor: "pointer", boxShadow: `0 0 24px ${T.accent}44`,
            }}>
              Connect my restaurant →
            </button>
            <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, marginTop: 8, opacity: 0.6 }}>7-day free trial · No commitment</div>
          </div>
        </div>

        {/* Stats panel — right on desktop */}
        {!isMobile && (
          <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12, alignSelf: "flex-start", marginTop: 40 }}>
            {[
              { num: "$3,400+", label: "Average annual loss from untracked price changes", icon: "📉" },
              { num: "5 min", label: "Setup time — scan your first invoice and you're live", icon: "⚡" },
              { num: "Any supplier", label: "Sysco, US Foods, local vendors", icon: "🔗" },
            ].map((s, i) => (
              <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 20, color: T.accent, marginBottom: 4, letterSpacing: "-0.02em" }}>{s.num}</div>
                <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, lineHeight: 1.5 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile tour bar */}
      {isMobile && tourStep > 0 && currentTour && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#0c160d", borderTop: `2px solid ${T.accent}`,
          padding: "10px 16px 20px", zIndex: 200,
          boxShadow: "0 -4px 24px #000000aa",
        }}>
          <div style={{ height: 3, background: T.faint, borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
            <div style={{ height: "100%", background: T.accent, borderRadius: 2, width: `${(tourStep / TOUR_STEPS.length) * 100}%`, transition: "width 0.4s ease" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: T.accent, color: "#0f1410", borderRadius: 20, padding: "2px 10px", fontSize: 10, fontFamily: T.font, fontWeight: 800, whiteSpace: "nowrap" }}>{tourStep}/{TOUR_STEPS.length}</div>
            <div style={{ flex: 1, fontSize: 12, color: T.text, fontFamily: T.body, lineHeight: 1.4, fontWeight: 500 }}>{currentTour.text}</div>
            <button onClick={nextTour} disabled={!tourStepDone} style={{
              background: tourStepDone ? T.accent : T.faint,
              color: tourStepDone ? "#0f1410" : T.muted,
              border: "none", borderRadius: 8, padding: "9px 14px",
              fontSize: 12, fontFamily: T.font, fontWeight: 800,
              cursor: tourStepDone ? "pointer" : "not-allowed", whiteSpace: "nowrap", flexShrink: 0,
            }}>
              {tourStep < TOUR_STEPS.length ? "Next →" : "Done ✓"}
            </button>
          </div>
          <button onClick={() => setTourStep(0)} style={{ background: "none", border: "none", color: T.muted, fontSize: 10, fontFamily: T.body, cursor: "pointer", textDecoration: "underline", display: "block", textAlign: "center", width: "100%", marginTop: 6 }}>Skip tour</button>
        </div>
      )}

      {/* ── BOTTOM CTA ── */}
      <div style={{ borderTop: `1px solid ${T.border}`, background: T.card, padding: "32px 24px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: isMobile ? 20 : 24, color: T.text, marginBottom: 8 }}>Ready to use this with your real restaurant?</div>
          <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, marginBottom: 20 }}>Set up in under 10 minutes. Scan your first invoice and you're live.</div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onSignUp} style={{ background: T.accent, color: "#0f1410", border: "none", borderRadius: 8, padding: "13px 30px", fontSize: 14, fontFamily: T.font, fontWeight: 800, cursor: "pointer", boxShadow: `0 0 24px ${T.accent}44` }}>
              Start free trial — $89/month →
            </button>
            {onBack && <button onClick={onBack} style={{ background: "transparent", color: T.muted, border: "none", fontSize: 13, fontFamily: T.body, cursor: "pointer", textDecoration: "underline" }}>← Back to home</button>}
          </div>
          <p style={{ fontSize: 11, color: T.muted, marginTop: 12, opacity: 0.5, fontFamily: T.body }}>7-day free trial · No commitment · Cancel anytime</p>
        </div>
      </div>
    </div>
  );
}

// ─── Account View ─────────────────────────────────────────────────────────────
function AccountView({ session, profile, onProfileUpdate, onSignOut }) {
  const [restaurantName, setRestaurantName] = useState(profile?.restaurant_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [state, setState] = useState(profile?.state || "");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(null);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const flash = (key) => { setSuccess(key); setTimeout(() => setSuccess(null), 3000); };

  const saveProfile = async () => {
    setSaving("profile"); setError(null);
    const { error } = await supabase.from("profiles").update({ restaurant_name: restaurantName, phone, state: state.toUpperCase() }).eq("id", session.user.id);
    setSaving(null);
    if (error) return setError(error.message);
    onProfileUpdate({ ...profile, restaurant_name: restaurantName, phone, state: state.toUpperCase() });
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
        <div>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 8 }}>State</div>
          <select value={state} onChange={e => setState(e.target.value)} style={{ width: "100%", background: T.faint, border: `1px solid ${T.border}`, borderRadius: 8, padding: "11px 14px", fontSize: 14, color: T.text, fontFamily: T.body, cursor: "pointer" }}>
            <option value="">Select your state</option>
            {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, marginTop: 6 }}>Used to find local supplier alternatives near you</div>
        </div>
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
  const isMobile = useIsMobile();

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

  const px = isMobile ? "20px" : "32px";
  const sectionPad = isMobile ? "52px 20px" : "80px 32px";

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: T.bg, fontFamily: T.body, color: T.text, boxSizing: "border-box", overflowX: "hidden" }}>

      {/* ── NAV ── */}
      <nav style={{ borderBottom: `1px solid ${T.border}`, background: "rgba(10,13,10,0.94)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ padding: `0 ${isMobile ? "20px" : "6%"}`, display: "flex", alignItems: "center", justifyContent: "space-between", height: isMobile ? 56 : 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: T.accentDim, border: `1.5px solid ${T.accentMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⬡</div>
            <span style={{ fontFamily: T.font, fontWeight: 800, fontSize: isMobile ? 17 : 19, color: T.text, letterSpacing: "-0.01em" }}>Kitchen<span style={{ color: T.accent }}>IQ</span></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 8 }}>
            {!isMobile && <button onClick={onLogin} style={{ background: "transparent", border: "none", color: T.muted, fontSize: 14, fontFamily: T.body, fontWeight: 500, cursor: "pointer", padding: "8px 14px" }}>Log in</button>}
            {!isMobile && <button onClick={onDemo} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.text, borderRadius: 7, padding: "8px 16px", fontSize: 13, fontFamily: T.body, fontWeight: 500, cursor: "pointer" }}>Live demo</button>}
            <button onClick={onSignUp} style={{ background: T.accent, color: "#0a0d0a", border: "none", borderRadius: 7, padding: isMobile ? "8px 16px" : "9px 20px", fontSize: 13, fontFamily: T.font, fontWeight: 700, cursor: "pointer" }}>
              {isMobile ? "Free trial" : "Start free trial"}
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO — full bleed background image ── */}
      <div style={{
        position: "relative",
        overflow: "hidden",
        minHeight: isMobile ? "520px" : "680px",
        display: "flex",
        alignItems: "center",
      }}>
        {/* Background image — dark commercial kitchen, no people */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=1800&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "grayscale(15%) brightness(0.4)",
        }} />
        {/* Dark gradient — heavy left where text is */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(90deg, rgba(10,13,10,0.97) 0%, rgba(10,13,10,0.85) 50%, rgba(10,13,10,0.5) 100%)",
        }} />
        {/* Bottom fade to site background */}
        <div style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          height: "100px",
          background: "linear-gradient(to bottom, transparent, #0a0d0a)",
        }} />

        {/* Content — full width, text flush left with padding */}
        <div style={{ position: "relative", zIndex: 2, width: "100%", ...fadeIn(0) }}>
          <div style={{ padding: isMobile ? "64px 20px 72px" : "110px 6% 110px" }}>
            <div style={{ maxWidth: isMobile ? "100%" : "48%" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: T.warnDim, border: `1px solid ${T.warn}33`, borderRadius: 100, padding: "5px 14px", marginBottom: isMobile ? 20 : 28 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.warn, opacity: pulse ? 1 : 0.45, transition: "opacity 0.6s" }} />
                <span className="landing-label" style={{ color: T.warn }}>For independent restaurant owners</span>
              </div>

              <h1 className="landing-h1" style={{ marginBottom: 10 }}>Your supplier raised prices.</h1>
              <h1 className="landing-h1" style={{ color: T.warn, marginBottom: isMobile ? 20 : 28 }}>Did you notice?</h1>

              <p className="landing-body" style={{ fontSize: isMobile ? 15 : 17, maxWidth: 500, marginBottom: isMobile ? 32 : 40 }}>
                KitchenIQ tracks every price change across all your suppliers automatically — so you always know your real food cost, on every dish, every day.
              </p>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={onSignUp} style={{ background: T.accent, color: "#0a0d0a", border: "none", borderRadius: 8, padding: isMobile ? "14px 28px" : "15px 34px", fontSize: isMobile ? 14 : 15, fontFamily: T.font, fontWeight: 700, cursor: "pointer", width: isMobile ? "100%" : "auto" }}>
                  Start free trial →
                </button>
                <button onClick={onDemo} style={{ background: "rgba(255,255,255,0.07)", color: T.text, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, padding: isMobile ? "14px 28px" : "15px 26px", fontSize: 14, fontFamily: T.body, fontWeight: 500, cursor: "pointer", backdropFilter: "blur(8px)", width: isMobile ? "100%" : "auto" }}>
                  ▶ Watch demo
                </button>
              </div>
              <p style={{ fontSize: 12, color: T.muted, marginTop: 14, opacity: 0.55, fontFamily: T.body }}>7-day free trial · No commitment · Cancel anytime</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS ROW ── */}
      <div style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, background: T.card, ...fadeIn(100) }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: `0 ${px}`, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)" }}>
          {[
            { num: "$3,400+", label: "Average annual loss from untracked price changes" },
            { num: "5 min", label: "Setup time — scan your first invoice and you're live" },
            { num: "Any supplier", label: "Sysco, US Foods, local vendors — works with all of them" },
          ].map((s, i) => (
            <div key={i} style={{ padding: isMobile ? "24px 0" : "32px 24px", borderRight: !isMobile && i < 2 ? `1px solid ${T.border}` : "none", borderBottom: isMobile && i < 2 ? `1px solid ${T.border}` : "none" }}>
              <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: isMobile ? 24 : 28, color: T.accent, marginBottom: 5, letterSpacing: "-0.02em" }}>{s.num}</div>
              <div className="landing-body" style={{ fontSize: 13 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: sectionPad, ...fadeIn(150) }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 40 : 80, alignItems: "center" }}>
          <div>
            <span className="landing-label" style={{ color: T.accent, display: "block", marginBottom: 14 }}>How it works</span>
            <h2 className="landing-h2" style={{ marginBottom: 14 }}>From invoice to insight in seconds</h2>
            <p className="landing-body" style={{ marginBottom: 36, fontSize: 15 }}>No spreadsheets. No manual entry. Just scan, and KitchenIQ handles the rest.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
              {[
                { n: "01", title: "Scan any invoice", desc: "Photo your supplier invoice — Sysco, US Foods, your local guys. AI reads every ingredient, price, and case size instantly." },
                { n: "02", title: "Get instant alerts", desc: "The moment a price changes you're notified. See exactly which dishes are affected and by how much per plate." },
                { n: "03", title: "Know your real margins", desc: "See your actual food cost percentage on every dish and get a suggested price to protect your margins." },
              ].map(s => (
                <div key={s.n} style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                  <div style={{ fontFamily: T.font, fontWeight: 700, fontSize: 11, color: T.accentMid, letterSpacing: "0.1em", paddingTop: 3, minWidth: 22, flexShrink: 0 }}>{s.n}</div>
                  <div>
                    <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 600, marginBottom: 4, letterSpacing: "-0.01em" }}>{s.title}</div>
                    <div className="landing-body" style={{ fontSize: 13 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mock alert card */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: isMobile ? 20 : 28, display: "flex", flexDirection: "column", gap: 12 }}>
            <span className="landing-label" style={{ color: T.muted, marginBottom: 4 }}>Live price alerts</span>
            {[
              { name: "Chicken Breast Boneless 40lb", change: "+22%", old: "$78.40", new: "$95.60", warn: true },
              { name: "Roma Tomatoes 25lb Case", change: "+14%", old: "$32.00", new: "$36.50", warn: true },
              { name: "Extra Virgin Olive Oil 4/1gal", change: "+9%", old: "$64.20", new: "$70.00", warn: true },
              { name: "Russet Potatoes 50lb", change: "-5%", old: "$28.00", new: "$26.60", warn: false },
            ].map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: T.faint, borderRadius: 10, padding: "12px 14px", border: `1px solid ${a.warn ? T.warn + "22" : T.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: T.text, fontFamily: T.font, fontWeight: 600, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>{a.old} → {a.new} per case</div>
                </div>
                <div style={{ fontSize: 13, fontFamily: T.font, fontWeight: 800, color: a.warn ? T.warn : T.accent, flexShrink: 0 }}>{a.change}</div>
              </div>
            ))}
            <div style={{ background: T.warnDim, border: `1px solid ${T.warn}33`, borderRadius: 8, padding: "11px 14px", marginTop: 2 }}>
              <div style={{ fontSize: 12, color: T.warn, fontFamily: T.body, lineHeight: 1.55 }}>⚠ Your Grilled Chicken plate now costs <strong>$1.24 more</strong> per serving. Consider adjusting your menu price.</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SUPPLIERS ── */}
      <div style={{ position: "relative", overflow: "hidden", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, ...fadeIn(200) }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "url('https://images.unsplash.com/photo-1495195134817-aeb325a55b65?w=1800&q=80')",
          backgroundSize: "cover", backgroundPosition: "center",
          filter: "grayscale(40%)", opacity: 0.15,
        }} />
        <div style={{ position: "absolute", inset: 0, background: T.card, opacity: 0.92 }} />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 1100, margin: "0 auto", padding: isMobile ? "48px 20px" : "56px 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 28 : 64, alignItems: "center" }}>
            <div>
              <span className="landing-label" style={{ color: T.accent, display: "block", marginBottom: 12 }}>Works with every supplier</span>
              <h2 className="landing-h2" style={{ marginBottom: 12 }}>Your restaurant doesn't use one supplier. Neither does KitchenIQ.</h2>
              <p className="landing-body" style={{ fontSize: 14 }}>Most food cost tools are locked to a single distributor. KitchenIQ works with every invoice from every supplier — giving you the full picture, not half of it.</p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["Sysco", "US Foods", "Performance Food Group", "Restaurant Depot", "Your Bread Guy", "Your Egg Farmer", "Local Meat Supplier", "✓ Any Supplier"].map((s, i) => (
                <div key={i} style={{ fontSize: 12, fontFamily: T.body, fontWeight: i === 7 ? 600 : 400, color: i === 7 ? T.accent : T.muted, background: i === 7 ? T.accentDim : T.faint, border: `1px solid ${i === 7 ? T.accentMid : T.border}`, borderRadius: 6, padding: "6px 13px" }}>{s}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── TESTIMONIAL + PAIN POINTS ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: sectionPad, ...fadeIn(250) }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 40 : 56, alignItems: "start" }}>
          <div>
            <div style={{ width: 3, height: 44, background: T.accent, borderRadius: 2, marginBottom: 22 }} />
            <blockquote style={{ fontFamily: T.body, fontSize: isMobile ? 16 : 18, color: T.text, lineHeight: 1.72, fontStyle: "italic", margin: "0 0 18px", fontWeight: 300 }}>
              "I had no idea my corned beef cost had changed. KitchenIQ caught it on the first scan — I would have never noticed otherwise."
            </blockquote>
            <div style={{ fontSize: 13, color: T.accent, fontFamily: T.font, fontWeight: 700, letterSpacing: "-0.01em" }}>Owner, Jake's Restaurant</div>
            <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 2 }}>North Stonington, CT</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              { title: "Prices change every delivery", desc: "Sysco, US Foods, local vendors — shifts happen constantly and quietly." },
              { title: "You're estimating your margins", desc: "Most owners guess food cost by feel. The real number is almost always worse." },
              { title: "Supplier tools show half the picture", desc: "Any tool tied to one distributor is blind to everything else you buy." },
            ].map(p => (
              <div key={p.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.warn, marginTop: 6, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 600, marginBottom: 3, letterSpacing: "-0.01em" }}>{p.title}</div>
                  <div className="landing-body" style={{ fontSize: 13 }}>{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BOTTOM CTA — with background image ── */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        {/* Background image */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1800&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "grayscale(20%) brightness(0.3)",
        }} />
        {/* Top fade from background */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: "120px",
          background: "linear-gradient(to bottom, #0a0d0a, transparent)",
        }} />
        {/* Dark overlay */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(10,13,10,0.88)",
        }} />

        <div style={{ position: "relative", zIndex: 2, padding: sectionPad }}>
          <div style={{ maxWidth: 580, margin: "0 auto", textAlign: "center" }}>
            <h2 className="landing-h2" style={{ marginBottom: 14 }}>
              Most restaurants lose more in a month than KitchenIQ costs in a year.
            </h2>
            <p className="landing-body" style={{ fontSize: 15, marginBottom: 10 }}>
              One unnoticed price spike on a high-volume ingredient can cost $200–$400 in a single month. KitchenIQ catches it automatically.
            </p>
            <p style={{ fontSize: 13, color: T.muted, fontFamily: T.body, marginBottom: 36, opacity: 0.65 }}>$89/month · $799/year · Cancel anytime</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={onSignUp} style={{ background: T.accent, color: "#0a0d0a", border: "none", borderRadius: 8, padding: "16px 40px", fontSize: 15, fontFamily: T.font, fontWeight: 700, cursor: "pointer", width: isMobile ? "100%" : "auto" }}>
                Start free trial →
              </button>
              {!isMobile && (
                <button onClick={onDemo} style={{ background: "rgba(255,255,255,0.08)", color: T.text, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "16px 28px", fontSize: 14, fontFamily: T.body, fontWeight: 500, cursor: "pointer", backdropFilter: "blur(8px)" }}>
                  ▶ Try demo first
                </button>
              )}
            </div>
            <p style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 14, opacity: 0.55 }}>Set up in under 10 minutes. No spreadsheets.</p>
            <div style={{ marginTop: 28, display: "flex", justifyContent: "center" }}>
              <LegalLinks />
            </div>
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
  // steps: 0=welcome "profile"=profile setup 1=scan1 2=scan2(optional) 3=dish 4=result
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Profile step state
  const [profileForm, setProfileForm] = useState({ restaurant_name: "", phone: "", state: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState(null);

  const saveProfile = async () => {
    if (!profileForm.restaurant_name.trim()) return setProfileError("Please enter your restaurant name.");
    if (!profileForm.phone.trim()) return setProfileError("Please enter your phone number.");
    if (!profileForm.state) return setProfileError("Please select your state.");
    setProfileSaving(true); setProfileError(null);
    const { error } = await supabase.from("profiles").update({
      restaurant_name: profileForm.restaurant_name.trim(),
      phone: profileForm.phone.trim(),
      state: profileForm.state,
    }).eq("id", session.user.id);
    setProfileSaving(false);
    if (error) return setProfileError("Failed to save. Please try again.");
    setStep(1);
  };

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
      const enhanced = await enhanceInvoiceImage(scanImageBase64);
      const response = await fetch("/api/scan-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: enhanced }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Scan failed");
      if (!data.items || data.items.length === 0) throw new Error("NO_ITEMS");
      setScanResults(data.items.map(r => normalizeIngredient(r)));
    } catch (e) {
      setScanError(e.message === "NO_ITEMS"
        ? "Couldn't find any food items. Make sure the invoice is fully visible."
        : `Scan failed: ${e.message}`);
    }
    setScanning(false);
  };

  const confirmScan = async () => {
    if (!scanResults) return;
    setSaving(true);
    const rows = scanResults.map(r => ({ ...r, price: Number(r.price), case_size: r.case_size ? Number(r.case_size) : null, user_id: session.user.id, is_supply: detectIsSupply(r.name) }));
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
                <button onClick={() => setStep("profile")} style={{ background: T.accent, color: "#0f1410", border: "none", borderRadius: 10, padding: "16px 48px", fontSize: 17, fontFamily: T.font, fontWeight: 800, cursor: "pointer", boxShadow: `0 0 32px ${T.accent}55` }}>
                  {isTracker ? "Let's Go →" : "Let's Go →"}
                </button>
                <button onClick={onComplete} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, fontFamily: T.body, cursor: "pointer", textDecoration: "underline" }}>
                  Skip setup — take me to the dashboard
                </button>
              </div>
            </div>
          )}

          {/* ── Profile Step ── */}
          {step === "profile" && (
            <div style={{ animation: "fadeIn 0.5s ease", maxWidth: 480, margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, background: T.accentDim, border: `2px solid ${T.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 20px" }}>🏪</div>
                <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 24, color: T.text, marginBottom: 8 }}>Tell us about your restaurant</div>
                <div style={{ fontSize: 14, color: T.muted, fontFamily: T.body, lineHeight: 1.6 }}>
                  This helps us find local supplier alternatives near you and lets us reach you if we spot something important.
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Restaurant Name */}
                <div>
                  <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 8 }}>Restaurant Name <span style={{ color: T.warn }}>*</span></div>
                  <input
                    value={profileForm.restaurant_name}
                    onChange={e => setProfileForm(p => ({ ...p, restaurant_name: e.target.value }))}
                    placeholder="e.g. Jake's Restaurant"
                    style={{ width: "100%", background: T.faint, border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 14px", fontSize: 14, color: T.text, fontFamily: T.body, outline: "none", boxSizing: "border-box" }}
                  />
                </div>

                {/* Phone */}
                <div>
                  <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 8 }}>Mobile Number <span style={{ color: T.warn }}>*</span></div>
                  <input
                    value={profileForm.phone}
                    onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="e.g. (860) 555-0123"
                    type="tel"
                    style={{ width: "100%", background: T.faint, border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 14px", fontSize: 14, color: T.text, fontFamily: T.body, outline: "none", boxSizing: "border-box" }}
                  />
                  <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, marginTop: 6 }}>Used to alert you about major price spikes when you're away from the app</div>
                </div>

                {/* State */}
                <div>
                  <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 8 }}>State <span style={{ color: T.warn }}>*</span></div>
                  <select
                    value={profileForm.state}
                    onChange={e => setProfileForm(p => ({ ...p, state: e.target.value }))}
                    style={{ width: "100%", background: T.faint, border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 14px", fontSize: 14, color: profileForm.state ? T.text : T.muted, fontFamily: T.body, outline: "none", cursor: "pointer", boxSizing: "border-box" }}
                  >
                    <option value="">Select your state</option>
                    {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, marginTop: 6 }}>Used to find local supplier alternatives near you</div>
                </div>

                {profileError && (
                  <div style={{ background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: T.warn, fontFamily: T.body }}>
                    {profileError}
                  </div>
                )}

                <button
                  onClick={saveProfile}
                  disabled={profileSaving}
                  style={{ background: T.accent, color: "#0f1410", border: "none", borderRadius: 8, padding: "14px 24px", fontSize: 15, fontFamily: T.font, fontWeight: 700, cursor: profileSaving ? "not-allowed" : "pointer", opacity: profileSaving ? 0.7 : 1, marginTop: 4 }}>
                  {profileSaving ? "Saving..." : "Continue — Scan My First Invoice →"}
                </button>

                <button onClick={() => setStep(1)} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, fontFamily: T.body, cursor: "pointer", textDecoration: "underline", textAlign: "center" }}>
                  Skip for now
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


// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: ingredients }, { data: menuItems }, { data: swapRequests }] = await Promise.all([
      supabase.rpc("admin_get_all_profiles"),
      supabase.rpc("admin_get_all_ingredients"),
      supabase.rpc("admin_get_all_menu_items"),
      supabase.from("swap_requests").select("*").order("created_at", { ascending: false }),
    ]);

    // Aggregate per user
    const users = (profiles || []).map(p => {
      const ings = (ingredients || []).filter(i => i.user_id === p.id);
      const menus = (menuItems || []).filter(m => m.user_id === p.id);
      const suppliers = new Set(ings.map(i => i.supplier).filter(Boolean));
      const lastScan = ings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]?.created_at;
      return { profile: p, ingredients: ings, menuItems: menus, suppliers, lastScan };
    });

    setData({ users, swapRequests: swapRequests || [] });
    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const timeSince = (dateStr) => {
    if (!dateStr) return "Never";
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: 60, color: T.muted, fontFamily: T.body, fontSize: 14 }}>
      Loading admin data...
    </div>
  );

  const { users, swapRequests } = data;
  const subscribed = users.filter(u => u.profile.is_subscribed);
  const mrr = subscribed.reduce((s, u) => s + (u.profile.subscription_tier === "full" ? 89 : u.profile.subscription_tier === "tracker" ? 25 : 0), 0);
  const totalIngredients = users.reduce((s, u) => s + u.ingredients.length, 0);
  const maxIngredients = Math.max(...users.map(u => u.ingredients.length), 1);
  const recentScans = [...(data.users.flatMap(u => u.ingredients.map(i => ({ ...i, restaurantName: u.profile.restaurant_name }))))].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);

  const StatCard = ({ label, value, sub, color }) => (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "20px 24px" }}>
      <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, fontFamily: T.font, color: color || T.text, letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 6 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 4 }}>Internal Only</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: T.font, color: T.text, letterSpacing: "-0.02em" }}>🛡 Admin Dashboard</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastUpdated && <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>Updated {lastUpdated.toLocaleTimeString()}</div>}
          <button onClick={load} style={{ background: T.faint, border: `1px solid ${T.border}`, color: T.muted, borderRadius: 7, padding: "7px 16px", fontSize: 12, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>↻ Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <StatCard label="MRR" value={`$${mrr}`} sub={`${subscribed.length} paying customers`} color={T.accent} />
        <StatCard label="Total Accounts" value={users.length} sub={`${subscribed.length} subscribed · ${users.length - subscribed.length} free`} />
        <StatCard label="Ingredients Tracked" value={totalIngredients} sub="across all accounts" />
        <StatCard label="Swap Requests" value={swapRequests.length} sub="supplier switches initiated" color={swapRequests.length > 0 ? T.accent : T.text} />
      </div>

      {/* Accounts Table */}
      <div>
        <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 12 }}>All Accounts</div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", padding: "12px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, fontFamily: T.body }}>
            <div>Restaurant</div><div>Plan</div><div>Ingredients</div><div>Menu Items</div><div>Suppliers</div><div>Last Active</div>
          </div>
          {users.map((u, i) => {
            const p = u.profile;
            const actPct = Math.min(100, (u.ingredients.length / maxIngredients) * 100);
            const tierColor = p.subscription_tier === "full" ? T.accent : p.subscription_tier === "tracker" ? T.warn : T.muted;
            const tierLabel = p.subscription_tier === "full" ? "Full" : p.subscription_tier === "tracker" ? "Tracker" : "None";
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", padding: "14px 20px", borderBottom: i < users.length - 1 ? `1px solid ${T.border}` : "none", fontSize: 13, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, color: T.text, fontFamily: T.font, fontSize: 14 }}>{p.restaurant_name || "Unnamed"}</div>
                  <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, marginTop: 2 }}>{p.state || "—"} · {p.id.slice(0, 8)}</div>
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: tierColor, background: tierColor + "22", border: `1px solid ${tierColor}44`, borderRadius: 4, padding: "3px 8px", fontFamily: T.font }}>
                    {tierLabel}
                  </span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: T.text, fontFamily: T.font }}>{u.ingredients.length}</div>
                  <div style={{ height: 3, background: T.faint, borderRadius: 2, width: 60, marginTop: 4 }}>
                    <div style={{ height: "100%", width: `${actPct}%`, background: T.accent, borderRadius: 2 }} />
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: T.text, fontFamily: T.font }}>{u.menuItems.length}</div>
                <div style={{ color: T.muted, fontFamily: T.body }}>{u.suppliers.size}</div>
                <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>{timeSince(u.lastScan)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Feature Adoption */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 16 }}>Feature Adoption</div>
          {[
            { name: "Invoice scanning", count: users.filter(u => u.ingredients.length > 0).length },
            { name: "Menu items added", count: users.filter(u => u.menuItems.length > 0).length },
            { name: "Recipes linked", count: users.filter(u => u.menuItems.some(m => (m.ingredients || []).length > 0)).length },
            { name: "Multi-supplier", count: users.filter(u => u.suppliers.size > 1).length },
            { name: "State set", count: users.filter(u => u.profile.state).length },
            { name: "Supplier swaps", count: swapRequests.length },
          ].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < 5 ? `1px solid ${T.border}` : "none" }}>
              <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>{f.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 60, height: 3, background: T.faint, borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${Math.max(4, (f.count / Math.max(users.length, 1)) * 100)}%`, background: T.accent, borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: T.font, minWidth: 32, textAlign: "right" }}>{f.count}/{users.length}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Revenue */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 16 }}>Revenue</div>
          {[
            { label: `Full plan (${users.filter(u => u.profile.subscription_tier === "full" && u.profile.is_subscribed).length} × $89)`, value: `$${users.filter(u => u.profile.subscription_tier === "full" && u.profile.is_subscribed).length * 89}` },
            { label: `Tracker plan (${users.filter(u => u.profile.subscription_tier === "tracker" && u.profile.is_subscribed).length} × $25)`, value: `$${users.filter(u => u.profile.subscription_tier === "tracker" && u.profile.is_subscribed).length * 25}` },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>{r.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.accent, fontFamily: T.font }}>{r.value}</div>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "14px 0 6px", borderTop: `1px solid ${T.accentMid}`, marginTop: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: T.font }}>MRR</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.accent, fontFamily: T.font, letterSpacing: "-0.02em" }}>${mrr}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>ARR (projected)</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.muted, fontFamily: T.font }}>${mrr * 12}</div>
          </div>
        </div>
      </div>

      {/* Recent scans */}
      <div>
        <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 12 }}>Recent Scans</div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "4px 20px" }}>
          {recentScans.length === 0
            ? <div style={{ padding: "20px 0", color: T.muted, fontFamily: T.body, fontSize: 13, textAlign: "center" }}>No scans yet</div>
            : recentScans.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderBottom: i < recentScans.length - 1 ? `1px solid ${T.border}` : "none" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.accent, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: T.text, fontFamily: T.font, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, marginTop: 2 }}>{s.restaurantName || "Unknown"} · ${s.price} from {s.supplier || "Unknown"}</div>
                </div>
                <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body, flexShrink: 0 }}>{timeSince(s.created_at)}</div>
              </div>
            ))}
        </div>
      </div>

    </div>
  );
}

const TABS = ["Dashboard", "Ingredients", "Menu Items", "Price Alerts", "Account", "Support"];
const ICONS = ["⬡", "🥬", "🍽", "⚡", "👤", "💬"];
const ADMIN_TAB = "Admin";
const ADMIN_ICON = "🛡";

function KitchenIQApp() {
  const { route, navigate } = useRoute();
  const isMobile = useIsMobile();
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const [ingredients, setIngredients] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [ingredientProfiles, setIngredientProfiles] = useState([]);
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
      const [{ data: ings }, { data: menus }, { data: als }, { data: profs }] = await Promise.all([
        supabase.from("ingredients").select("*").order("created_at", { ascending: false }),
        supabase.from("menu_items").select("*").order("created_at", { ascending: false }),
        supabase.from("ingredient_aliases").select("*").eq("user_id", session.user.id),
        supabase.from("user_ingredient_profiles").select("*").eq("user_id", session.user.id),
      ]);
      setIngredients(ings || []);
      setMenuItems(menus || []);
      setAliases(als || []);
      setIngredientProfiles(profs || []);
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
    <div style={{ minHeight: "100vh", width: "100%", background: T.bg, fontFamily: T.body, color: T.text, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      {/* Top header bar */}
      <div style={{ borderBottom: `1px solid ${T.border}`, background: T.card, flexShrink: 0 }}>
        <div style={{ maxWidth: isMobile ? "100%" : "none", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: T.accentDim, border: `1px solid ${T.accentMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⬡</div>
            <span style={{ fontFamily: T.font, fontWeight: 800, fontSize: 17, color: T.text }}>Kitchen<span style={{ color: T.accent }}>IQ</span></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>{session.user.email}</span>
            <button onClick={() => exportCSV(ingredients, menuItems)} style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, color: T.accent, borderRadius: 6, padding: "6px 12px", fontSize: 11, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>↓ CSV</button>
            <button onClick={signOut} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 6, padding: "6px 12px", fontSize: 11, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>Sign Out</button>
          </div>
        </div>
      </div>

      {/* Body — sidebar + content on desktop, stack on mobile */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left sidebar — desktop only */}
        {!isMobile && (
          <div style={{ width: 200, flexShrink: 0, background: T.card, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", padding: "16px 0" }}>
            {TABS.map((t, i) => {
              const alertCount = i === 3 ? getPriceAlerts(ingredients.filter(x => !x.is_supply)).length : 0;
              const isActive = tab === i;
              return (
                <button key={i} onClick={() => setTab(i)} style={{
                  background: isActive ? T.accentDim : "none",
                  border: "none",
                  borderLeft: `3px solid ${isActive ? T.accent : "transparent"}`,
                  color: isActive ? T.accent : T.muted,
                  padding: "11px 20px",
                  fontSize: 13, fontFamily: T.font, fontWeight: isActive ? 700 : 500,
                  cursor: "pointer", transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                }}>
                  <span style={{ fontSize: 15 }}>{ICONS[i]}</span>
                  {t}
                  {alertCount > 0 && <span style={{ background: T.warn, color: "#fff", borderRadius: 10, fontSize: 10, padding: "2px 6px", fontFamily: T.font, fontWeight: 700, marginLeft: "auto" }}>{alertCount}</span>}
                </button>
              );
            })}
            {profile?.is_admin && (
              <button onClick={() => setTab(99)} style={{ background: tab === 99 ? T.accentDim : "none", border: "none", borderLeft: `3px solid ${tab === 99 ? T.accent : "transparent"}`, color: tab === 99 ? T.accent : T.muted, padding: "11px 20px", fontSize: 13, fontFamily: T.font, fontWeight: tab === 99 ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left" }}>
                <span style={{ fontSize: 15 }}>{ADMIN_ICON}</span>{ADMIN_TAB}
              </button>
            )}
          </div>
        )}

        {/* Main content */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
          {/* Mobile tab bar */}
          {isMobile && (
            <div style={{ borderBottom: `1px solid ${T.border}`, background: T.card, display: "flex", overflowX: "auto", flexShrink: 0 }}>
              {TABS.map((t, i) => {
                const alertCount = i === 3 ? getPriceAlerts(ingredients.filter(x => !x.is_supply)).length : 0;
                return (
                  <button key={i} onClick={() => setTab(i)} style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === i ? T.accent : "transparent"}`, color: tab === i ? T.accent : T.muted, padding: "12px 16px", fontSize: 12, fontFamily: T.font, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                    {ICONS[i]} {t}
                    {alertCount > 0 && <span style={{ background: T.warn, color: "#fff", borderRadius: 10, fontSize: 9, padding: "2px 5px", fontFamily: T.font, fontWeight: 700 }}>{alertCount}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {priceNotif && priceNotif.length > 0 && (
            <div style={{ padding: "12px 20px 0" }}>
              {priceNotif.map((c, idx) => (
                <div key={idx} style={{ background: "#1a0a00", border: `1px solid ${T.warn}`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 8, animation: "slideInDown 0.4s ease" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.warn, flexShrink: 0, boxShadow: `0 0 8px ${T.warn}`, marginTop: 5 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: T.warn, fontFamily: T.font, fontWeight: 700 }}>⚠ {c.name} {c.pct > 0 ? "increased" : "decreased"} {Math.abs(c.pct).toFixed(0)}% — ${Number(c.oldPrice).toFixed(2)} → ${Number(c.newPrice).toFixed(2)}</div>
                    {c.affectedDishes?.length > 0 && c.affectedDishes.map((d, i) => (
                      <div key={i} style={{ fontSize: 11, color: d.impact > 0 ? T.warn : T.accent, fontFamily: T.body, marginTop: 3 }}>{d.impact > 0 ? "↑" : "↓"} {d.dish} costs {d.impact > 0 ? "+" : ""}{fmt$2(d.impact)} more per plate</div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => { setTab(3); setPriceNotif(null); }} style={{ background: T.warn, color: "#0f1410", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11, fontFamily: T.font, fontWeight: 700, cursor: "pointer" }}>View →</button>
                    <button onClick={() => setPriceNotif(null)} style={{ background: "none", border: "none", color: T.muted, fontSize: 16, cursor: "pointer" }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ padding: "20px", flex: 1, boxSizing: "border-box" }}>
            {loading
              ? <div style={{ textAlign: "center", color: T.muted, fontFamily: T.body, padding: 60 }}>Loading your data...</div>
              : <>
                {tab === 0 && <Dashboard ingredients={ingredients} menuItems={menuItems} onNavigate={setTab} tier={profile?.subscription_tier} aliases={aliases} />}
                {tab === 1 && <IngredientsView ingredients={ingredients} setIngredients={setIngredients} userId={session.user.id} userEmail={session.user.email} menuItems={menuItems} onPriceChange={(changes) => { setPriceNotif(changes); setTimeout(() => setPriceNotif(null), 12000); }} aliases={aliases} setAliases={setAliases} ingredientProfiles={ingredientProfiles} setIngredientProfiles={setIngredientProfiles} />}
                {tab === 2 && (profile?.subscription_tier === "tracker"
                  ? <TrackerUpgradeGate feature="Menu Items & Margin Calculations" />
                  : <MenuView menuItems={menuItems} setMenuItems={setMenuItems} ingredients={ingredients} userId={session.user.id} session={session} profile={profile} aliases={aliases} />
                )}
                {tab === 3 && <AlertsView ingredients={ingredients} session={session} profile={profile} aliases={aliases} />}
                {tab === 4 && <AccountView session={session} profile={profile} onProfileUpdate={setProfile} onSignOut={signOut} />}
                {tab === 5 && <SupportView session={session} />}
                {tab === 99 && profile?.is_admin && <AdminView />}
              </>}
          </div>
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