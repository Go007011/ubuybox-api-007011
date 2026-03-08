const { app } = require("@azure/functions");
const { getSheetRows, parseNumericValue } = require("../../services/googleSheets");

async function getDashboardPayload() {
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

  return {
    status: "dashboard working",
    ...summary,
    activeSPVs: activeSpvIds.size,
  };
}

async function buildDashboardResponse() {
  try {
    return {
      status: 200,
      jsonBody: await getDashboardPayload(),
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
}

app.http("dashboard", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "dashboard",
  handler: async () => buildDashboardResponse(),
});

module.exports = async function (context, req) {
  const response = await buildDashboardResponse();

  context.res = {
    status: response.status,
    headers: {
      "Content-Type": "application/json",
    },
    body: response.jsonBody,
  };
};
