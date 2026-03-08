const { google } = require("googleapis");

let sheetsPromise;

function getEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === null) {
    return "";
  }

  return value.toString().trim();
}

function requireEnv(name) {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normalizePrivateKey(rawKey) {
  return rawKey.replace(/\\n/g, "\n");
}

function hasServiceAccountConfig() {
  return Boolean(getEnv("GOOGLE_CLIENT_EMAIL") && getEnv("GOOGLE_PRIVATE_KEY"));
}

async function getSheetsClient() {
  if (!sheetsPromise) {
    sheetsPromise = (async () => {
      if (!hasServiceAccountConfig()) {
        return null;
      }

      const clientEmail = getEnv("GOOGLE_CLIENT_EMAIL");
      const privateKey = normalizePrivateKey(getEnv("GOOGLE_PRIVATE_KEY"));

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });

      return google.sheets({
        version: "v4",
        auth: await auth.getClient(),
      });
    })();
  }

  return sheetsPromise;
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

  const value = cell.v ?? cell.f ?? "";
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value.toString();
}

async function readPublicRange(sheetId, range) {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    sheetId,
  )}/gviz/tq?tqx=out:json&range=${encodeURIComponent(range)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google gviz request failed: ${response.status} ${response.statusText}`);
  }

  const responseText = await response.text();
  const payloadText = extractGvizPayload(responseText);

  let parsed;
  try {
    parsed = JSON.parse(payloadText);
  } catch (error) {
    throw new Error("Failed to parse Google gviz response payload.");
  }

  const table = parsed?.table;
  if (!table) {
    return [];
  }

  const headers = Array.isArray(table.cols)
    ? table.cols.map((column) => column?.label || column?.id || "")
    : [];
  const rows = Array.isArray(table.rows)
    ? table.rows.map((row) =>
        Array.isArray(row?.c) ? row.c.map((cell) => gvizCellToValue(cell)) : [],
      )
    : [];

  return headers.length > 0 ? [headers, ...rows] : rows;
}

async function readRange(range) {
  if (!range) {
    return [];
  }

  const sheetId = requireEnv("GOOGLE_SHEET_ID");
  const sheets = await getSheetsClient();
  if (!sheets) {
    return readPublicRange(sheetId, range);
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
    majorDimension: "ROWS",
  });

  return Array.isArray(response?.data?.values) ? response.data.values : [];
}

async function readDashboardRanges() {
  const sharedRange = requireEnv("GOOGLE_SHEETS_RANGE");
  const ranges = {
    // Canonical configuration for this deployment lane.
    deals: getEnv("GOOGLE_SHEET_RANGE_DEALS") || sharedRange,
    orders: getEnv("GOOGLE_SHEET_RANGE_ORDERS") || sharedRange,
    summary: getEnv("GOOGLE_SHEET_RANGE_SUMMARY") || sharedRange,
    charts: getEnv("GOOGLE_SHEET_RANGE_CHARTS") || sharedRange,
  };

  const [deals, orders, summary, charts] = await Promise.all([
    readRange(ranges.deals),
    readRange(ranges.orders),
    readRange(ranges.summary),
    readRange(ranges.charts),
  ]);

  return {
    ranges,
    values: {
      deals,
      orders,
      summary,
      charts,
    },
  };
}

module.exports = {
  hasServiceAccountConfig,
  readDashboardRanges,
  readRange,
};
