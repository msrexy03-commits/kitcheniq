import { useState, useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Analytics } from "@vercel/analytics/next"

// ─── Fonts via Google ───────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap";
document.head.appendChild(fontLink);

// ─── Helpers ────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().split("T")[0];
const fmt$ = (n) => `$${Number(n).toFixed(2)}`;
const fmtPct = (n) => `${Number(n).toFixed(1)}%`;

function calcMenuStats(item) {
  const cost = item.ingredients.reduce((s, i) => s + Number(i.cost), 0);
  const profit = Number(item.salePrice) - cost;
  const margin = item.salePrice > 0 ? (profit / item.salePrice) * 100 : 0;
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
    if (prev.price === 0) return;
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
    const { cost, profit, margin } = calcMenuStats(m);
    rows.push(["Menu Item", m.name, fmt$(m.salePrice), fmt$(cost), fmtPct(margin), ""]);
  });
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "kitcheniq-export.csv"; a.click();
}

// ─── Theme ──────────────────────────────────────────────────────────────────
const T = {
  bg: "#0f1410", card: "#161d17", border: "#1e2b1f",
  accent: "#4eca6e", accentDim: "#4eca6e22", accentMid: "#4eca6e55",
  warn: "#e8854a", warnDim: "#e8854a22",
  text: "#e8f0e9", muted: "#6b8a6e", faint: "#2a3a2b",
  font: "'Syne', sans-serif", body: "'DM Sans', sans-serif",
};

// ─── Sub-components ──────────────────────────────────────────────────────────
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

// ─── Views ───────────────────────────────────────────────────────────────────

function Dashboard({ ingredients, menuItems }) {
  const alerts = getPriceAlerts(ingredients);
  const menuStats = menuItems.map((m) => ({ ...m, ...calcMenuStats(m) }));
  const best = menuStats.length ? menuStats.reduce((a, b) => a.margin > b.margin ? a : b) : null;
  const worst = menuStats.length ? menuStats.reduce((a, b) => a.margin < b.margin ? a : b) : null;
  const avgMargin = menuStats.length ? menuStats.reduce((s, m) => s + m.margin, 0) / menuStats.length : 0;

  // Chart data — last 8 ingredient price entries
  const chartData = ingredients.slice(-12).map((i) => ({ name: i.name.slice(0, 8), price: i.price }));
  const marginData = menuStats.slice(0, 8).map((m) => ({ name: m.name.slice(0, 10), margin: parseFloat(m.margin.toFixed(1)) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Stat row */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatCard label="Ingredients Tracked" value={ingredients.length} accent />
        <StatCard label="Menu Items" value={menuItems.length} />
        <StatCard label="Avg Margin" value={fmtPct(avgMargin)} sub={avgMargin > 60 ? "Healthy ✓" : avgMargin > 40 ? "Watch closely" : "⚠ Low"} accent={avgMargin > 60} />
        <StatCard label="Price Alerts" value={alerts.length} sub={alerts.length ? alerts[0].name : "All stable"} accent={alerts.length === 0} />
      </div>

      {/* Charts */}
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
                  {marginData.map((entry, i) => (
                    <Cell key={i} fill={entry.margin > 60 ? T.accent : entry.margin > 40 ? "#e8c84a" : T.warn} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 13, fontFamily: T.body }}>Add menu items to see chart</div>}
        </div>
      </div>

      {/* Best/Worst + Alerts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body, marginBottom: 16 }}>Margin Leaders</div>
          {best ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>🏆 Best</span>
                <span style={{ fontSize: 13, color: T.accent, fontFamily: T.font, fontWeight: 600 }}>{best.name} — {fmtPct(best.margin)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>⚠ Worst</span>
                <span style={{ fontSize: 13, color: T.warn, fontFamily: T.font, fontWeight: 600 }}>{worst.name} — {fmtPct(worst.margin)}</span>
              </div>
            </>
          ) : <div style={{ fontSize: 13, color: T.muted, fontFamily: T.body }}>No menu items yet</div>}
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

function IngredientsView({ ingredients, setIngredients }) {
  const [modal, setModal] = useState(null); // null | 'add' | {edit: ingredient}
  const [form, setForm] = useState({ name: "", supplier: "", date: today(), price: "", unit: "" });
  const [editId, setEditId] = useState(null);

  const openAdd = () => { setForm({ name: "", supplier: "", date: today(), price: "", unit: "" }); setEditId(null); setModal("form"); };
  const openEdit = (ing) => { setForm({ name: ing.name, supplier: ing.supplier, date: ing.date, price: String(ing.price), unit: ing.unit }); setEditId(ing.id); setModal("form"); };

  const save = () => {
    if (!form.name || !form.supplier || !form.date || !form.price || !form.unit) return alert("Please fill in all fields.");
    if (isNaN(parseFloat(form.price))) return alert("Price must be a number.");
    const entry = { ...form, price: parseFloat(form.price), id: editId || uid() };
    if (editId) setIngredients((prev) => prev.map((i) => i.id === editId ? entry : i));
    else setIngredients((prev) => [...prev, entry]);
    setModal(null);
  };

  const del = (id) => { if (window.confirm("Delete this ingredient?")) setIngredients((prev) => prev.filter((i) => i.id !== id)); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: T.body }}>{ingredients.length} ingredients tracked</div>
        <Btn onClick={openAdd}>+ Add Ingredient</Btn>
      </div>

      {ingredients.length === 0
        ? <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 40, textAlign: "center", color: T.muted, fontFamily: T.body }}>No ingredients yet. Add your first one.</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
        </div>}

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
              <Btn onClick={save}>{editId ? "Save Changes" : "Add Ingredient"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MenuView({ menuItems, setMenuItems }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", salePrice: "", ingredients: [{ ingredient_name: "", cost: "" }] });
  const [editId, setEditId] = useState(null);

  const openAdd = () => { setForm({ name: "", salePrice: "", ingredients: [{ ingredient_name: "", cost: "" }] }); setEditId(null); setModal("form"); };
  const openEdit = (m) => { setForm({ name: m.name, salePrice: String(m.salePrice), ingredients: m.ingredients.map((i) => ({ ...i, cost: String(i.cost) })) }); setEditId(m.id); setModal("form"); };

  const addRow = () => setForm((f) => ({ ...f, ingredients: [...f.ingredients, { ingredient_name: "", cost: "" }] }));
  const updateRow = (i, field, val) => setForm((f) => ({ ...f, ingredients: f.ingredients.map((row, idx) => idx === i ? { ...row, [field]: val } : row) }));

  const save = () => {
    if (!form.name || !form.salePrice) return alert("Please enter name and sale price.");
    const ings = form.ingredients.filter((r) => r.ingredient_name && r.cost);
    if (!ings.length) return alert("Add at least one ingredient.");
    const entry = { name: form.name, salePrice: parseFloat(form.salePrice), ingredients: ings.map((r) => ({ ingredient_name: r.ingredient_name, cost: parseFloat(r.cost) })), id: editId || uid() };
    if (editId) setMenuItems((prev) => prev.map((m) => m.id === editId ? entry : m));
    else setMenuItems((prev) => [...prev, entry]);
    setModal(null);
  };

  const del = (id) => { if (window.confirm("Delete this menu item?")) setMenuItems((prev) => prev.filter((m) => m.id !== id)); };

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
                    <div style={{ fontSize: 12, color: T.muted, fontFamily: T.body, marginTop: 4 }}>
                      {m.ingredients.map((i) => i.ingredient_name).join(", ")}
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
                  <span style={{ fontSize: 12, color: T.muted, fontFamily: T.body }}>Sale: <strong style={{ color: T.text }}>{fmt$(m.salePrice)}</strong></span>
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
              <Btn onClick={save}>{editId ? "Save Changes" : "Add Item"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AlertsView({ ingredients }) {
  const alerts = getPriceAlerts(ingredients);
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

// ─── App Shell ───────────────────────────────────────────────────────────────
const TABS = ["Dashboard", "Ingredients", "Menu Items", "Price Alerts"];
const ICONS = ["⬡", "🥬", "🍽", "⚡"];

export default function KitchenIQ() {
  const [tab, setTab] = useState(0);
  const [ingredients, setIngredients] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: T.bg, fontFamily: T.body, color: T.text, boxSizing: "border-box", overflowX: "hidden" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: T.card, height: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: T.accentDim, border: `1px solid ${T.accentMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⬡</div>
          <span style={{ fontFamily: T.font, fontWeight: 800, fontSize: 18, color: T.text, letterSpacing: "-0.3px" }}>Kitchen<span style={{ color: T.accent }}>IQ</span></span>
          <span style={{ fontSize: 10, color: T.muted, letterSpacing: "0.15em", marginLeft: 4, fontFamily: T.body }}>v1.0 · trykitcheniq.com</span>
        </div>
        <button onClick={() => exportCSV(ingredients, menuItems)}
          style={{ background: T.accentDim, border: `1px solid ${T.accentMid}`, color: T.accent, borderRadius: 6, padding: "7px 16px", fontSize: 12, fontFamily: T.font, fontWeight: 600, cursor: "pointer", letterSpacing: "0.05em" }}>
          ↓ Export CSV
        </button>
      </div>

      {/* Nav */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "0 24px", display: "flex", gap: 0, background: T.card, overflowX: "auto" }}>
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

      {/* Content */}
      <div style={{ width: "100%", padding: "32px 24px", boxSizing: "border-box" }}>
        {tab === 0 && <Dashboard ingredients={ingredients} menuItems={menuItems} />}
        {tab === 1 && <IngredientsView ingredients={ingredients} setIngredients={setIngredients} />}
        {tab === 2 && <MenuView menuItems={menuItems} setMenuItems={setMenuItems} />}
        {tab === 3 && <AlertsView ingredients={ingredients} />}
      </div>
    </div>
  );
}