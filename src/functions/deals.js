const { getSheetRows } = require("../services/googleSheets");

module.exports = async function (context, req) {

  try {

    const rows = await getSheetRows();

    let deals = rows.map(row => ({
      dealId: row.Deal || row.deal || row.deal_id || "",
      spv: row.SPV || row.spv || row.spv_id || "",
      property: row.Property || "",
      city: row.City || "",
      state: row.State || "",
      county: row.County || "",
      price: Number(row.Price || 0),
      capitalRequested: Number(row.CapitalRequested || 0),
      capitalRaised: Number(row.CapitalRaised || 0),
      owner: row.Owner || "",
      email: row.Email || ""
    }));

    const { spv, state, limit } = req.query || {};

    if (spv) {
      deals = deals.filter(d => d.spv === spv);
    }

    if (state) {
      deals = deals.filter(d => d.state === state);
    }

    if (limit) {
      deals = deals.slice(0, Number(limit));
    }

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

};const { getSheetRows } = require("../services/googleSheets");

module.exports = async function (context, req) {

  try {

    const rows = await getSheetRows();

    let deals = rows.map(row => ({
      dealId: row.Deal || row.deal || row.deal_id || "",
      spv: row.SPV || row.spv || row.spv_id || "",
      property: row.Property || "",
      city: row.City || "",
      state: row.State || "",
      county: row.County || "",
      price: Number(row.Price || 0),
      capitalRequested: Number(row.CapitalRequested || 0),
      capitalRaised: Number(row.CapitalRaised || 0),
      owner: row.Owner || "",
      email: row.Email || ""
    }));

    const { spv, state, limit } = req.query || {};

    if (spv) {
      deals = deals.filter(d => d.spv === spv);
    }

    if (state) {
      deals = deals.filter(d => d.state === state);
    }

    if (limit) {
      deals = deals.slice(0, Number(limit));
    }

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