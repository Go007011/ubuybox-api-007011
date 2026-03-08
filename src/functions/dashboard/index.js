const { getSheetRows } = require("../../services/googleSheets");

module.exports = async function (context, req) {

  try {

    const rows = await getSheetRows();

    const totalDeals = rows.length;

    const activeSPVs = new Set(
      rows.map(r => r.SPV || r.spv || r.spv_id).filter(Boolean)
    ).size;

    const capitalRequested = rows.reduce((sum, r) => {
      const value = Number(r.CapitalRequested || r.capital_requested || 0);
      return sum + value;
    }, 0);

    const capitalRaised = rows.reduce((sum, r) => {
      const value = Number(r.CapitalRaised || r.capital_raised || 0);
      return sum + value;
    }, 0);

    const recentDeals = rows.slice(-10).reverse();

    context.res = {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: {
        totalDeals,
        activeSPVs,
        capitalRequested,
        capitalRaised,
        recentDeals
      }
    };

  } catch (error) {

    context.log.error("Dashboard error:", error);

    context.res = {
      status: 500,
      body: {
        error: "Failed to load dashboard data"
      }
    };

  }

};