import Anthropic from "@anthropic-ai/sdk";
import {
  TextractClient,
  AnalyzeDocumentCommand,
} from "@aws-sdk/client-textract";

const textract = new TextractClient({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const anthropic = new Anthropic({ apiKey: process.env.VITE_ANTHROPIC_API_KEY });

// ── Textract table extraction ──────────────────────────────────────────────────
function extractTableFromTextract(response) {
  const blocks = response.Blocks || [];
  const blockMap = {};
  blocks.forEach((b) => { blockMap[b.Id] = b; });

  // Find all tables
  const tables = blocks.filter((b) => b.BlockType === "TABLE");
  if (tables.length === 0) return null;

  // Use the largest table (most cells = the invoice table)
  const table = tables.reduce((a, b) => {
    const aCount = (a.Relationships || []).flatMap((r) => r.Ids || []).length;
    const bCount = (b.Relationships || []).flatMap((r) => r.Ids || []).length;
    return bCount > aCount ? b : a;
  });

  // Build a row/col grid from CELL blocks
  const cells = (table.Relationships || [])
    .filter((r) => r.Type === "CHILD")
    .flatMap((r) => r.Ids)
    .map((id) => blockMap[id])
    .filter((b) => b && b.BlockType === "CELL");

  const grid = {};
  let maxRow = 0;
  let maxCol = 0;

  cells.forEach((cell) => {
    const row = cell.RowIndex;
    const col = cell.ColumnIndex;
    if (!grid[row]) grid[row] = {};

    // Get text from WORD children
    const text = (cell.Relationships || [])
      .filter((r) => r.Type === "CHILD")
      .flatMap((r) => r.Ids)
      .map((id) => blockMap[id])
      .filter((b) => b && b.BlockType === "WORD")
      .map((b) => b.Text)
      .join(" ");

    grid[row][col] = text;
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
  });

  // Convert to array of rows
  const rows = [];
  for (let r = 1; r <= maxRow; r++) {
    const row = [];
    for (let c = 1; c <= maxCol; c++) {
      row.push(grid[r]?.[c] || "");
    }
    rows.push(row);
  }

  return rows;
}

// ── Also extract raw LINE text for header info (supplier, date) ───────────────
function extractLines(response) {
  return (response.Blocks || [])
    .filter((b) => b.BlockType === "LINE")
    .map((b) => b.Text || "")
    .join("\n");
}

// ── Detect supplier from header lines ─────────────────────────────────────────
function detectSupplier(lines) {
  if (/sysco/i.test(lines)) return "Sysco";
  if (/us foods/i.test(lines)) return "US Foods";
  if (/performance food/i.test(lines)) return "Performance Food Group";
  if (/restaurant depot/i.test(lines)) return "Restaurant Depot";
  return "Unknown";
}

// ── Detect invoice date ────────────────────────────────────────────────────────
function detectDate(lines) {
  const match = lines.match(/\b(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  const match2 = lines.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/);
  if (match2) return `${match2[3]}-${match2[1].padStart(2, "0")}-${match2[2].padStart(2, "0")}`;
  return new Date().toISOString().split("T")[0];
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });

  try {
    // ── Step 1: Textract — extract raw table data ──────────────────────────────
    const imageBytes = Buffer.from(imageBase64, "base64");

    const textractResult = await textract.send(
      new AnalyzeDocumentCommand({
        Document: { Bytes: imageBytes },
        FeatureTypes: ["TABLES"],
      })
    );

    const tableRows = extractTableFromTextract(textractResult);
    const rawLines = extractLines(textractResult);
    const supplier = detectSupplier(rawLines);
    const date = detectDate(rawLines);

    if (!tableRows || tableRows.length === 0) {
      return res.status(422).json({ error: "NO_TABLE", message: "Textract couldn't find a table in this image." });
    }

    // Format table as readable text for Claude
    const tableText = tableRows
      .map((row, i) => `Row ${i + 1}: ${row.map((cell, j) => `[${j + 1}]${cell}`).join(" | ")}`)
      .join("\n");

    // ── Step 2: Claude — interpret the clean table text into JSON ──────────────
    const today = new Date().toISOString().split("T")[0];

    const message = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `You are a restaurant invoice data processor. A table was extracted from a Sysco/food supplier invoice using OCR. Convert it to structured JSON.

SUPPLIER DETECTED: ${supplier}
DATE DETECTED: ${date}

RAW TABLE (each row is one line, columns are numbered [1], [2], etc):
${tableText}

SYSCO TABLE COLUMN ORDER (typical):
[1] QTY ordered | [2] PACK | [3] SIZE | [4] ITEM DESCRIPTION | [5] ITEM CODE | [6] UNIT PRICE | [7] PAST DUE | [8] EXTENDED PRICE

RULES:
- SKIP rows that are section headers (contain "***", "GROUP TOTAL", "ORDER SUMMARY", "MISC CHARGES", "SUB TOTAL", "TAX", "INVOICE TOTAL")
- SKIP rows with no numeric item code
- SKIP rows where the description is blank or just a category label
- Each real product row has a 7-digit item code in column [5]

PRICE: Use UNIT PRICE (col [6]) — the smaller price. Extended price = unit price × qty, never use it.
For catch-weight items (T/WT= appears in description or next row), unit price is per-lb. Use T/WT value as case_size.

CASE SIZE: Parse from SIZE column [3]:
- "25 LB" → case_size: 25, case_unit: "lb"
- "802 OZ" → case_size: 802, case_unit: "oz"
- "1010CT" → case_size: 1010, case_unit: "each"
- "9620Z" → case_size: 96, case_unit: "oz"
- "904.5 OZ" → case_size: 904.5, case_unit: "oz"
- "35LB" → case_size: 35, case_unit: "lb"

NAME: Strip these prefixes/brands from description: SYS, CLS, SYS CLS, REL, CTVCLS, BHB/NPM, OZPILLSBY, LONGINI, CITVCLS, JONES D, PILLSBY
Format as "Type Descriptor" in Title Case. Examples:
- "SYS CLS SAUSAGE PORK PATTY CKD CN NAT" → "Sausage Pork Patty Cooked"
- "BHB/NPM STEAK STRIP VEIN FRZN" → "Steak Strip Vein Frozen"
- "JONES D SAUSAGE PORK PATTY CKD" → "Sausage Pork Patty Cooked"
- "CITVCLS COFFEE GRND HSE BLEND MED W/F" → "Coffee Ground House Blend Medium"
- "SYS REL GLOVE VINYL FDSVC PF XL" → "Glove Vinyl Foodservice"
- "LONGINI SAUSAGE ITALIAN SWEET BULK" → "Sausage Italian Sweet Bulk"
- "SYS CLS CHICKEN BRST IFZ BNLS/SKL" → "Chicken Breast Boneless Skinless Frozen"
- "SYS CLS CHICKEN TNDR BRD ORIG FLAT SM" → "Chicken Tender Breaded Original Flat Small"
- "OZPILLSBY DOUGH ROLL CINNAMON CLASSI" → "Dough Roll Cinnamon"

is_supply: true for gloves, paper products, cleaning supplies, fuel surcharges, fees. false for food/beverage.

Return ONLY a raw JSON array, no markdown, no backticks:
[{"name":"...","price":0.00,"case_size":0,"case_unit":"lb","unit":"lb","supplier":"${supplier}","date":"${date}","is_supply":false}]`
      }]
    });

    let text = message.content[0].text.trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const items = JSON.parse(text);
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(422).json({ error: "NO_ITEMS", message: "No line items found." });
    }

    return res.status(200).json({ items, supplier, date });

  } catch (e) {
    console.error("Scan error:", e);
    return res.status(500).json({ error: e.message || "Scan failed" });
  }
}