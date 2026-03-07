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

async function getSheetsClient() {
  if (!sheetsPromise) {
    sheetsPromise = (async () => {
      const clientEmail = requireEnv("GOOGLE_CLIENT_EMAIL");
      const privateKey = normalizePrivateKey(requireEnv("GOOGLE_PRIVATE_KEY"));

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

async function readRange(range) {
  if (!range) {
    return [];
  }

  const sheetId = requireEnv("GOOGLE_SHEET_ID");
  const sheets = await getSheetsClient();
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
  readDashboardRanges,
  readRange,
};
