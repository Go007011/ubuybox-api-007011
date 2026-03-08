const { getSheetRows } = require("../services/googleSheets");

const startTime = Date.now();

module.exports = async function (context, req) {

  try {

    const rows = await getSheetRows();

    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    context.res = {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: {
        status: "ok",
        api: "UBUYBOX API",
        uptimeSeconds,
        sheetRowsLoaded: rows.length,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {

    context.log.error("Health check failed:", error);

    context.res = {
      status: 500,
      body: {
        status: "error",
        message: "API health check failed"
      }
    };

  }

};