const { getSheetRows } = require("../services/googleSheets");

module.exports = async function (context, req) {

  try {

    const rows = await getSheetRows();

    const deals = rows.map(row => ({
      dealId: row.Deal || row.deal || row.deal_id || "",
      spv: row.SPV || row.spv || row.spv_id || "",
      property: row.Property || row.property || "",
      city: row.City || row.city || "",
      state: row.State || row.state || "",
      county: row.County || row.county || "",
      price: Number(row.Price || row.price || 0),
      capitalRequested: Number(row.CapitalRequested || row.capital_requested || 0),
      capitalRaised: Number(row.CapitalRaised || row.capital_raised || 0),
      owner: row.Owner || row.owner || "",
      email: row.Email || row.email || ""
    }));

    context.res = {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: deals
    };

  } catch (error) {

    context.log.error("Deals endpoint error:", error);

    context.res = {
      status: 500,
      body: {
        error: "Failed to load deals"
      }
    };

  }

};