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

const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().split("T")[0];
const fmt$ = (n) => `$${Number(n).toFixed(2)}`;
const fmtPct = (n) => `${Number(n).toFixed(1)}%`;

function calcMenuStats(item) {
  const cost = (item.ingredients || []).reduce((s, i) => s + Number(i.cost), 0);
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
  const rows = [["Type", "Name", "Supplier/Sale Price", "Date/Cost", "Price/Margin", "Unit"]];
  ingredients.forEach((i) => rows.push(["Ingredient", i.name, i.supplier, i.date, fmt$(i.price), i.unit]));
  menuItems.forEach((m) => {
    const { cost, margin } = calcMenuStats(m);
    rows.push(["Menu Item", m.name, fmt$(m.sale_price), fmt$(cost), fmtPct(margin), ""]);
  });
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "kitcheniq-export.csv"; a.click();
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

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontFamily: T.font, fontSize: 18, color: T.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Auth Screen ─────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
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
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: T.accentDim, border: `1px solid ${T.accentMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>⬡</div>
          <div style={{ fontFamily: T.font, fontWeight: 800, fontSize: 28, color: T.text }}>Kitchen<span style={{ color: T.accent }}>IQ</span></div>
          <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body, marginTop: 6 }}>Restaurant cost intelligence</div>
        </div>

        {/* Card */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 32 }}>
          <div style={{ display: "flex", gap: 4, background: T.faint, borderRadius: 8, padding: 4, marginBottom: 28 }}>
            {["login", "signup"].map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(null); setMessage(null); }} style={{
                flex: 1, padding: "8px 0", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13,
                fontFamily: T.font, fontWeight: 600, letterSpacing: "0.03em",
                background: mode === m ? T.accent : "transparent",
                color: mode === m ? "#0f1410" : T.muted,
                transition: "all 0.15s",
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
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
              marginTop: 4, letterSpacing: "0.03em",
            }}>
              {loading ? "..." : mode === "login" ? "Log In" : "Create Account"}
            </button>
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: T.muted, fontFamily: T.body }}>
          Your data is encrypted and stored securely
        </div>
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
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
              { type: "text", text: `You are a restaurant invoice parser. Analyze this supplier invoice image and extract every product line item.

Return ONLY a raw JSON array. No markdown, no backticks, no explanation, no preamble.

For each line item extract:
- name: the product name, cleaned up but ONLY using words actually printed on the invoice. Remove item numbers, SKU codes, and quantity descriptors. NEVER guess, infer, or substitute words not on the invoice. If you cannot read a word clearly, skip it rather than guess. Examples: 'BACON SLICED 18/14-16CT' becomes 'Bacon Sliced'. 'SAUSAGE LINKS ITALIAN SWEET PORK' becomes 'Italian Sweet Sausage'. 'CHEDDAR JACK CHEESE SHREDDED CASAIMP' becomes 'Cheddar Jack Cheese Shredded' — drop the unreadable code, never replace it with a guess.
- price: the UNIT price — cost per single unit, NOT the extended/total line price. If invoice shows QTY 4 x $12.50 = $50.00 then price is 12.50 not 50.00
- unit: the unit of measure for ONE unit. Rules:
  * Sold by weight: use "lb" or "oz"
  * Sold as a case: use "case"
  * Sold individually: use "each"
  * Sold by pack: use "pack"
  * Sold by bag: use "bag"
  * NEVER use quantity numbers as the unit (not "4 case", just "case")
  * Never leave blank, guess from context if needed
- supplier: vendor/company name from invoice header (or "Unknown")
- date: invoice date YYYY-MM-DD format (use ${today()} if not visible)

Critical rules:
- ONE JSON object per invoice line item. Never split one line into two, never combine two lines into one.
- Never guess or infer product names. Only use words visibly printed on the invoice.
- If a line item is unclear, include it with your best literal reading rather than skipping it.

Invoice layout hints:
- Sysco/US Foods columns: Item# | Description | Pack/Size | QTY | Unit Price | Extended Price — always use Unit Price column, never Extended Price
- For any invoice: find the per-unit cost, not the line total

Example output:
[{"name":"Roma Tomatoes","price":1.89,"unit":"lb","supplier":"Sysco","date":"${today()}"},{"name":"Chicken Breast","price":42.50,"unit":"case","supplier":"Sysco","date":"${today()}"},{"name":"Large Eggs","price":3.20,"unit":"each","supplier":"Local Farm","date":"${today()}"}]` }
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

  const confirmImport = () => {
    onIngredientsFound(results.map((r) => ({ ...r, price: Number(r.price) })));
    onClose();
  };

  return (
    <Modal title="📸 AI Invoice Scanner" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: T.accent, fontFamily: T.body }}>
          ✨ Powered by AI — photo your invoice and ingredients auto-fill instantly
        </div>
        <div onClick={() => document.getElementById("invoice-upload").click()} style={{
          border: `2px dashed ${image ? T.accentMid : T.border}`, borderRadius: 10,
          padding: "28px 20px", textAlign: "center", cursor: "pointer",
          background: image ? T.accentDim : T.faint, transition: "all 0.2s",
        }}>
          {image
            ? <img src={image} alt="Invoice" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 6, objectFit: "contain" }} />
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
            <div style={{ fontSize: 11, color: T.accent, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 10 }}>✓ Found {results.length} ingredients</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
              {results.map((r, i) => (
                <div key={i} style={{ background: T.faint, borderRadius: 6, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, color: T.text, fontFamily: T.font, fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: T.muted, fontFamily: T.body }}>{r.supplier} · {r.unit} · {r.date}</div>
                  </div>
                  <span style={{ fontSize: 15, color: T.accent, fontFamily: T.font, fontWeight: 700 }}>{fmt$(r.price)}</span>
                </div>
              ))}
            </div>
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
function Dashboard({ ingredients, menuItems }) {
  const alerts = getPriceAlerts(ingredients);
  const menuStats = menuItems.map((m) => ({ ...m, ...calcMenuStats(m) }));
  const best = menuStats.length ? menuStats.reduce((a, b) => a.margin > b.margin ? a : b) : null;
  const worst = menuStats.length ? menuStats.reduce((a, b) => a.margin < b.margin ? a : b) : null;
  const avgMargin = menuStats.length ? menuStats.reduce((s, m) => s + m.margin, 0) / menuStats.length : 0;
  const chartData = ingredients.slice(-12).map((i) => ({ name: i.name.slice(0, 8), price: i.price }));
  const marginData = menuStats.slice(0, 8).map((m) => ({ name: m.name.slice(0, 10), margin: parseFloat(m.margin.toFixed(1)) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatCard label="Ingredients Tracked" value={ingredients.length} accent />
        <StatCard label="Menu Items" value={menuItems.length} />
        <StatCard label="Avg Margin" value={fmtPct(avgMargin)} sub={avgMargin > 60 ? "Healthy ✓" : avgMargin > 40 ? "Watch closely" : "⚠ Low"} accent={avgMargin > 60} />
        <StatCard label="Price Alerts" value={alerts.length} sub={alerts.length ? alerts[0].name : "All stable"} accent={alerts.length === 0} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 16 }}>Recent Ingredient Prices</div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData}>
                <XAxis dataKey="name" tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, fontFamily: T.body, fontSize: 12 }} />
                <Line type="monotone" dataKey="price" stroke={T.accent} strokeWidth={2} dot={{ fill: T.accent, r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 13, fontFamily: T.body }}>Add ingredients to see chart</div>}
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
function IngredientsView({ ingredients, setIngredients, userId }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", supplier: "", date: today(), price: "", unit: "" });
  const [editId, setEditId] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setForm({ name: "", supplier: "", date: today(), price: "", unit: "" }); setEditId(null); setModal("form"); };
  const openEdit = (ing) => { setForm({ name: ing.name, supplier: ing.supplier || "", date: ing.date || today(), price: String(ing.price), unit: ing.unit || "" }); setEditId(ing.id); setModal("form"); };

  const save = async () => {
    if (!form.name || !form.price) return alert("Name and price are required.");
    if (isNaN(parseFloat(form.price))) return alert("Price must be a number.");
    setSaving(true);
    const entry = { name: form.name, supplier: form.supplier, date: form.date, price: parseFloat(form.price), unit: form.unit, user_id: userId };
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
    const rows = items.map((r) => ({ name: r.name, supplier: r.supplier, date: r.date, price: r.price, unit: r.unit, user_id: userId }));
    const { data, error } = await supabase.from("ingredients").insert(rows).select();
    if (!error) setIngredients((prev) => [...prev, ...data]);
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
          {ingredients.map((ing) => (
            <div key={ing.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, color: T.text, fontFamily: T.font, fontWeight: 600 }}>{ing.name}</div>
                <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 3 }}>{ing.supplier} · {ing.date} · {ing.unit}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 16, color: T.accent, fontFamily: T.font, fontWeight: 700 }}>{fmt$(ing.price)}</span>
                <Btn small variant="ghost" onClick={() => openEdit(ing)}>Edit</Btn>
                <Btn small variant="danger" onClick={() => del(ing.id)}>Del</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {showScanner && <InvoiceScanner onIngredientsFound={handleScanned} onClose={() => setShowScanner(false)} />}

      {modal === "form" && (
        <Modal title={editId ? "Edit Ingredient" : "Add Ingredient"} onClose={() => setModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Ingredient Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Input label="Supplier" value={form.supplier} onChange={(v) => setForm({ ...form, supplier: v })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} placeholder="YYYY-MM-DD" />
              <Input label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} placeholder="lb, oz, case..." />
            </div>
            <Input label="Price ($)" value={form.price} onChange={(v) => setForm({ ...form, price: v })} type="number" />
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

// ─── Menu Items ───────────────────────────────────────────────────────────────
function MenuView({ menuItems, setMenuItems, userId }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", salePrice: "", ingredients: [{ ingredient_name: "", cost: "" }] });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setForm({ name: "", salePrice: "", ingredients: [{ ingredient_name: "", cost: "" }] }); setEditId(null); setModal("form"); };
  const openEdit = (m) => { setForm({ name: m.name, salePrice: String(m.sale_price), ingredients: (m.ingredients || []).map((i) => ({ ...i, cost: String(i.cost) })) }); setEditId(m.id); setModal("form"); };
  const addRow = () => setForm((f) => ({ ...f, ingredients: [...f.ingredients, { ingredient_name: "", cost: "" }] }));
  const updateRow = (i, field, val) => setForm((f) => ({ ...f, ingredients: f.ingredients.map((row, idx) => idx === i ? { ...row, [field]: val } : row) }));

  const save = async () => {
    if (!form.name || !form.salePrice) return alert("Please enter name and sale price.");
    const ings = form.ingredients.filter((r) => r.ingredient_name && r.cost).map((r) => ({ ingredient_name: r.ingredient_name, cost: parseFloat(r.cost) }));
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
        <Btn onClick={openAdd}>+ Add Menu Item</Btn>
      </div>
      {menuItems.length === 0
        ? <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 40, textAlign: "center", color: T.muted, fontFamily: T.body }}>No menu items yet.</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {menuItems.map((m) => {
            const { cost, profit, margin } = calcMenuStats(m);
            const color = margin > 60 ? T.accent : margin > 40 ? "#e8c84a" : T.warn;
            return (
              <div key={m.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 15, color: T.text, fontFamily: T.font, fontWeight: 700 }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 4 }}>{(m.ingredients || []).map((i) => i.ingredient_name).join(", ")}</div>
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
                  <span style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>Sale: <strong style={{ color: T.text }}>{fmt$(m.sale_price)}</strong></span>
                  <span style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>Cost: <strong style={{ color: T.text }}>{fmt$(cost)}</strong></span>
                  <span style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>Profit: <strong style={{ color: T.accent }}>{fmt$(profit)}</strong></span>
                </div>
              </div>
            );
          })}
        </div>}
      {modal === "form" && (
        <Modal title={editId ? "Edit Menu Item" : "Add Menu Item"} onClose={() => setModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Menu Item Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Input label="Sale Price ($)" value={form.salePrice} onChange={(v) => setForm({ ...form, salePrice: v })} type="number" />
            <div>
              <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 10 }}>Ingredient Costs</div>
              {form.ingredients.map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 8, marginBottom: 8 }}>
                  <input value={row.ingredient_name} onChange={(e) => updateRow(i, "ingredient_name", e.target.value)} placeholder="Ingredient name"
                    style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 6, padding: "9px 12px", color: T.text, fontSize: 13, fontFamily: T.body, outline: "none" }} />
                  <input value={row.cost} onChange={(e) => updateRow(i, "cost", e.target.value)} placeholder="Cost $" type="number"
                    style={{ background: T.faint, border: `1px solid ${T.border}`, borderRadius: 6, padding: "9px 12px", color: T.text, fontSize: 13, fontFamily: T.body, outline: "none" }} />
                </div>
              ))}
              <button onClick={addRow} style={{ background: "none", border: `1px dashed ${T.border}`, borderRadius: 6, color: T.muted, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontFamily: T.body, width: "100%", marginTop: 4 }}>+ Add row</button>
            </div>
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
                <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 4 }}>{fmt$(a.oldPrice)} → {fmt$(a.newPrice)} · {a.unit} · {a.date}</div>
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

// ─── App Shell ────────────────────────────────────────────────────────────────
const TABS = ["Dashboard", "Ingredients", "Menu Items", "Price Alerts"];
const ICONS = ["⬡", "🥬", "🍽", "⚡"];

export default function KitchenIQ() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [tab, setTab] = useState(0);
  const [ingredients, setIngredients] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load data when logged in
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

  const signOut = async () => {
    await supabase.auth.signOut();
    setIngredients([]); setMenuItems([]);
  };

  // Loading state
  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: T.accent, fontFamily: T.font, fontSize: 18 }}>Loading...</div>
      </div>
    );
  }

  // Not logged in
  if (!session) return <AuthScreen onAuth={setSession} />;

  // App
  return (
    <div style={{ minHeight: "100vh", width: "100%", background: T.bg, fontFamily: T.body, color: T.text, boxSizing: "border-box", overflowX: "hidden" }}>
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: T.card, height: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: T.accentDim, border: `1px solid ${T.accentMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⬡</div>
          <span style={{ fontFamily: T.font, fontWeight: 800, fontSize: 18, color: T.text }}>Kitchen<span style={{ color: T.accent }}>IQ</span></span>
          <span style={{ fontSize: 10, color: T.muted, letterSpacing: "0.15em", marginLeft: 4, fontFamily: T.body, display: "none" }} className="hide-mobile">v1.0</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>{session.user.email}</span>
          <button onClick={() => exportCSV(ingredients, menuItems)}
            style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, color: T.accent, borderRadius: 6, padding: "7px 14px", fontSize: 12, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>
            ↓ CSV
          </button>
          <button onClick={signOut}
            style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 6, padding: "7px 14px", fontSize: 12, fontFamily: T.font, fontWeight: 600, cursor: "pointer" }}>
            Sign Out
          </button>
        </div>
      </div>
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "0 24px", display: "flex", background: T.card, overflowX: "auto" }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            background: "none", border: "none", borderBottom: `2px solid ${tab === i ? T.accent : "transparent"}`,
            color: tab === i ? T.accent : T.muted, padding: "14px 20px", fontSize: 13, fontFamily: T.font,
            fontWeight: 600, cursor: "pointer", transition: "color 0.15s", letterSpacing: "0.03em", whiteSpace: "nowrap",
          }}>
            {ICONS[i]} {t}
          </button>
        ))}
      </div>
      <div style={{ width: "100%", padding: "32px 24px", boxSizing: "border-box" }}>
        {loading
          ? <div style={{ textAlign: "center", color: T.muted, fontFamily: T.body, padding: 60 }}>Loading your data...</div>
          : <>
            {tab === 0 && <Dashboard ingredients={ingredients} menuItems={menuItems} />}
            {tab === 1 && <IngredientsView ingredients={ingredients} setIngredients={setIngredients} userId={session.user.id} />}
            {tab === 2 && <MenuView menuItems={menuItems} setMenuItems={setMenuItems} userId={session.user.id} />}
            {tab === 3 && <AlertsView ingredients={ingredients} />}
          </>}
      </div>
    </div>
  );
}