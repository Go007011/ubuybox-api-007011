const { google } = require("googleapis");

const CACHE_TTL_MS = 60 * 1000;
const DEFAULT_WORKSHEET_NAME = "SPV Maps to GHL Dashboard";
const SHEET_COLUMNS_RANGE = "A:Z";

let cachedRows = null;
let cacheExpiresAt = 0;
let pendingRowsPromise = null;
let sheetsClient = null;

/* =============================
   Environment Validation
============================= */

function requireSheetId() {
  const sheetId = process.env.SHEET_ID?.toString().trim()
    || process.env.GOOGLE_SHEET_ID?.toString().trim();

  if (!sheetId) {
    throw new Error("Environment variable SHEET_ID or GOOGLE_SHEET_ID is required.");
  }

  return sheetId;
}

/* =============================
   Helpers
============================= */

function normalizeCell(value) {
  if (value === undefined || value === null) return "";
  return value.toString().trim();
}

function parseNumericValue(value) {
  const raw = normalizeCell(value);
  if (!raw) return 0;

  const negative = raw.startsWith("(") && raw.endsWith(")");
  const sanitized = raw.replace(/[$,%\s,()]/g, "");
  const parsed = Number.parseFloat(sanitized);

  if (!Number.isFinite(parsed)) return 0;

  return negative ? parsed * -1 : parsed;
}

function escapeSheetName(name) {
  return `'${name.replace(/'/g, "''")}'`;
}

function extractGvizPayload(rawBody) {
  const match = rawBody.match(/setResponse\(([\s\S]*)\);?$/);
  if (!match || !match[1]) {
    throw new Error("Invalid Google gviz response format.");
  }

  return match[1];
}

function gvizCellToValue(cell) {
  if (!cell) {
    return "";
  }

  const value = cell.f ?? cell.v ?? "";
  if (value === null || value === undefined) {
    return "";
  }

  return value.toString().trim();
}

/* =============================
   Google Auth
============================= */

function buildAuthConfig() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL?.toString().trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.toString().trim();

  return {
    credentials: clientEmail && privateKey
      ? {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, "\n"),
        }
      : undefined,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.readonly"
    ]
  };
}

function hasServiceAccountConfig() {
  return Boolean(
    process.env.GOOGLE_CLIENT_EMAIL?.toString().trim()
    && process.env.GOOGLE_PRIVATE_KEY?.toString().trim()
  );
}

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const auth = new google.auth.GoogleAuth(buildAuthConfig());

  sheetsClient = google.sheets({
    version: "v4",
    auth: await auth.getClient()
  });

  return sheetsClient;
}

/* =============================
   Worksheet Resolution
============================= */

async function resolveWorksheetName(sheets, spreadsheetId) {

  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(title,index))"
  });

  const worksheets = metadata.data?.sheets ?? [];

  const match = worksheets.find(
    s => s.properties?.title === DEFAULT_WORKSHEET_NAME
  );

  if (match?.properties?.title) {
    return match.properties.title;
  }

  const fallback = worksheets[0]?.properties?.title;

  if (!fallback) {
    throw new Error("No worksheets found in spreadsheet.");
  }

  return fallback;
}

/* =============================
   Row Mapping
============================= */

function mapRowsToObjects(values) {

  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  const [headers, ...rows] = values;

  const normalizedHeaders = headers.map(normalizeCell);

  return rows
    .filter(row =>
      Array.isArray(row) &&
      row.some(cell => normalizeCell(cell) !== "")
    )
    .map(row => {

      const obj = {};

      normalizedHeaders.forEach((header, i) => {

        if (!header) return;

        obj[header] = normalizeCell(row[i]);

      });

      return obj;

    });

}

/* =============================
   Sheet Fetch
============================= */

async function fetchRowsFromSheet() {

  const spreadsheetId = requireSheetId();

  try {
    if (!hasServiceAccountConfig()) {
      throw new Error("Service account credentials are not configured.");
    }

    const sheets = await getSheetsClient();

    const worksheet = await resolveWorksheetName(
      sheets,
      spreadsheetId
    );

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${escapeSheetName(worksheet)}!${SHEET_COLUMNS_RANGE}`,
      majorDimension: "ROWS"
    });

    return mapRowsToObjects(res.data?.values);
  } catch (error) {
    const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
      spreadsheetId
    )}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(DEFAULT_WORKSHEET_NAME)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw error;
    }

    const payload = extractGvizPayload(await response.text());
    const parsed = JSON.parse(payload);
    const headers = Array.isArray(parsed?.table?.cols)
      ? parsed.table.cols.map((column) => column?.label || column?.id || "")
      : [];
    const rows = Array.isArray(parsed?.table?.rows)
      ? parsed.table.rows.map((row) =>
          Array.isArray(row?.c) ? row.c.map(gvizCellToValue) : [],
        )
      : [];

    return mapRowsToObjects(headers.length > 0 ? [headers, ...rows] : rows);
  }
}

/* =============================
   Cached Access
============================= */

async function getSheetRows() {

  const now = Date.now();

  if (cachedRows && cacheExpiresAt > now) {
    return cachedRows;
  }

  if (!pendingRowsPromise) {

    pendingRowsPromise = fetchRowsFromSheet()
      .then(rows => {

        cachedRows = rows;
        cacheExpiresAt = Date.now() + CACHE_TTL_MS;
        pendingRowsPromise = null;

        return rows;

      })
      .catch(err => {

        pendingRowsPromise = null;
        throw err;

      });

  }

  return pendingRowsPromise;
}

/* =============================
   Cache Reset
============================= */

function clearSheetCache() {

  cachedRows = null;
  cacheExpiresAt = 0;
  pendingRowsPromise = null;

}

/* =============================
   Exports
============================= */

module.exports = {
  getSheetRows,
  clearSheetCache,
  parseNumericValue
};
