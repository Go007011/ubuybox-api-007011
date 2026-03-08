const { app } = require("@azure/functions");
const { getSheetRows, parseNumericValue } = require("../services/googleSheets");

app.http("spvs", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async () => {
    try {
      const rows = await getSheetRows();
      const spvs = rows.map((row) => ({
        spvId: row.SPV_ID || "",
        dealId: row.Deal_ID || "",
        capitalTarget: parseNumericValue(row.TOTAL_CAPITAL_REQUIRED),
        capitalCommitted: parseNumericValue(row.TOTAL_RAISED),
        unitsTotal: parseNumericValue(row.TOTAL_UNITS),
        unitsRemaining: parseNumericValue(row.UNITS_REMAINING),
      }));

      return {
        jsonBody: spvs,
      };
    } catch (error) {
      return {
        status: 500,
        jsonBody: {
          error: "Failed to load SPVs from Google Sheets.",
          details: error.message,
        },
      };
    }
  },
});
