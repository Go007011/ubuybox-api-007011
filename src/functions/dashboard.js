const { app } = require("@azure/functions");
const { getSheetRows, parseNumericValue } = require("../services/googleSheets");

app.http("dashboard", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async () => {
    try {
      const rows = await getSheetRows();
      const activeSpvIds = new Set();
      const summary = rows.reduce(
        (totals, row) => {
          totals.totalDeals += 1;
          if ((row.SPV_ID || "").trim()) {
            activeSpvIds.add(row.SPV_ID.trim());
          }

          totals.capitalRequested += parseNumericValue(row.TOTAL_CAPITAL_REQUIRED);
          totals.capitalRaised += parseNumericValue(row.TOTAL_RAISED);

          return totals;
        },
        {
          totalDeals: 0,
          activeSPVs: 0,
          capitalRequested: 0,
          capitalRaised: 0,
        },
      );

      summary.activeSPVs = activeSpvIds.size;

      return {
        jsonBody: {
          status: "dashboard working",
          ...summary,
        },
      };
    } catch (error) {
      return {
        status: 500,
        jsonBody: {
          error: "Failed to load dashboard data from Google Sheets.",
          details: error.message,
        },
      };
    }
  },
});
