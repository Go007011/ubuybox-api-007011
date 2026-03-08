const { app } = require("@azure/functions");
const { getSheetRows, parseNumericValue } = require("../services/googleSheets");

app.http("deals", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async () => {
    try {
      const rows = await getSheetRows();
      const deals = rows.map((row) => ({
        dealId: row.Deal_ID || "",
        property: row["Property Address"] || "",
        state: row.State || "",
        county: row.County || "",
        purchasePrice: parseNumericValue(row["Purchase Price"]),
        status: row.Status || "",
        capitalRequired: parseNumericValue(row.TOTAL_CAPITAL_REQUIRED),
        capitalRaised: parseNumericValue(row.TOTAL_RAISED),
        unitsTotal: parseNumericValue(row.TOTAL_UNITS),
        unitsSold: parseNumericValue(row.UNITS_SOLD),
        unitsRemaining: parseNumericValue(row.UNITS_REMAINING),
      }));

      return {
        jsonBody: deals,
      };
    } catch (error) {
      return {
        status: 500,
        jsonBody: {
          error: "Failed to load deals from Google Sheets.",
          details: error.message,
        },
      };
    }
  },
});
