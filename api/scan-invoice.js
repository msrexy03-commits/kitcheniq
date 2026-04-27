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

    console.log("Textract total rows:", tableRows?.length);
    console.log("Textract rows sample:", JSON.stringify(tableRows?.slice(0, 20)));
    console.log("Raw lines sample:", rawLines.slice(0, 500));

    // Pre-filter rows before sending to Claude — drop obvious headers/totals/blanks
    const SKIP_PATTERNS = /group total|order summary|misc charges|sub total|invoice total|last page|\*\*\*|^\s*$/i;
    const filteredRows = tableRows.filter(row => {
      const rowText = row.join(" ").trim();
      if (!rowText) return false;
      if (SKIP_PATTERNS.test(rowText)) return false;
      // Must have at least one cell with a number (price or item code)
      if (!/\d/.test(rowText)) return false;
      return true;
    });

    if (filteredRows.length === 0) {
      return res.status(422).json({ error: "NO_TABLE", message: "Textract couldn't find any product rows." });
    }

    console.log("Filtered rows count:", filteredRows.length);
    console.log("Filtered rows:", JSON.stringify(filteredRows));

    // Format table as compact text for Claude — only send relevant columns
    const tableText = filteredRows
      .map((row, i) => row.filter(c => c.trim()).join(" | "))
      .join("\n");

    // ── Step 2: Claude — interpret the clean table text into JSON ──────────────
    const today = new Date().toISOString().split("T")[0];

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Convert these pre-filtered invoice rows to JSON. Supplier: ${supplier}. Date: ${date}.

Each row format: QTY | PACK | SIZE | DESCRIPTION | ITEM CODE | UNIT PRICE | PAST DUE | EXTENDED PRICE

RULES:
- price = UNIT PRICE (smaller number). Never use EXTENDED PRICE.
- case_size/case_unit from SIZE: "25 LB"→25/lb, "802 OZ"→802/oz, "35LB"→35/lb, "1010CT"→1010/each, "9620Z"→96/oz
- For catch-weight rows (T/WT= in description): price is per-lb, use T/WT value as case_size
- name: strip prefixes (SYS, CLS, SYS CLS, REL, CTVCLS, BHB/NPM, LONGINI, CITVCLS) and brands (JONES D, PILLSBY, OZPILLSBY). Title Case.
- is_supply: true for gloves/paper/fees/surcharges, false for food

ROWS:
${tableText}

Return ONLY a JSON array, no markdown:
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