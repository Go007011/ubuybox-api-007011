const { getSheetRows } = require("../services/googleSheets");

module.exports = async function (context, req) {

  try {

    const rows = await getSheetRows();

    const spvMap = {};

    rows.forEach(row => {

      const spvId = row.SPV || row.spv || row.spv_id;

      if (!spvId) return;

      if (!spvMap[spvId]) {
        spvMap[spvId] = {
          spv: spvId,
          deals: [],
          capitalRequested: 0,
          capitalRaised: 0
        };
      }

      const capitalRequested = Number(row.CapitalRequested || row.capital_requested || 0);
      const capitalRaised = Number(row.CapitalRaised || row.capital_raised || 0);

      spvMap[spvId].deals.push({
        dealId: row.Deal || row.deal || row.deal_id || "",
        property: row.Property || "",
        city: row.City || "",
        state: row.State || "",
        price: Number(row.Price || 0)
      });

      spvMap[spvId].capitalRequested += capitalRequested;
      spvMap[spvId].capitalRaised += capitalRaised;

    });

    const spvs = Object.values(spvMap).map(spv => ({
      ...spv,
      fillPercent:
        spv.capitalRequested > 0
          ? Math.round((spv.capitalRaised / spv.capitalRequested) * 100)
          : 0
    }));

    context.res = {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: spvs
    };

  } catch (error) {

    context.log.error("SPV endpoint error:", error);

    context.res = {
      status: 500,
      body: {
        error: "Failed to load SPVs"
      }
    };

  }

};