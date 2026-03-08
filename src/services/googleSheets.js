const { google } = require("googleapis");

const CACHE_TTL_MS = 60 * 1000;
const DEFAULT_WORKSHEET_NAME = "SPV Maps to GHL Dashboard";
const SHEET_COLUMNS_RANGE = "A:Z";

const GOOGLE_SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive"
];

let cachedRows = null;
let cacheExpiresAt = 0;
let pendingRowsPromise = null;
let sheetsClient = null;

let refreshTimer = null;

function startBackgroundRefresh() {

  if (refreshTimer) return;

  refreshTimer = setInterval(async () => {

    try {

      console.log("Refreshing Google Sheets cache in background");

      const rows = await fetchRowsFromSheet();

      cachedRows = rows;
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    } catch (err) {

      console.error("Background refresh failed:", err.message);

    }

  }, CACHE_TTL_MS);

}
/* =============================
   Environment Validation
============================= */

function requireSheetId() {

  const sheetId =
    process.env.SHEET_ID?.trim() ||
    process.env.GOOGLE_SHEET_ID?.trim();

  if (!sheetId) {
    throw new Error("Missing SHEET_ID or GOOGLE_SHEET_ID");
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

function escapeSheetName(name) {

  return `'${name.replace(/'/g, "''")}'`;

}

/* =============================
   Google Auth (Keyless)
============================= */

async function getSheetsClient() {

  if (sheetsClient) return sheetsClient;

  console.log("Initializing Google Sheets auth via ADC");

  const auth = new google.auth.GoogleAuth({
    scopes: GOOGLE_SHEETS_SCOPES
  });

  const client = await auth.getClient();

  sheetsClient = google.sheets({
    version: "v4",
    auth: client
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

  console.log(`Reading Sheet ID: ${spreadsheetId}`);

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

}

/* =============================
   Cached Access
============================= */

async function getSheetRows() {

  startBackgroundRefresh();

  if (cachedRows) {
    return cachedRows;
  }

  const rows = await fetchRowsFromSheet();

  cachedRows = rows;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;

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
  clearSheetCache
};