const { sendJson } = require("../shared/httpResponses");
const { getCatalogResponse, readQuery } = require("../shared/fractionalCatalog");

module.exports = async function (context, req) {
  try {
    const result = getCatalogResponse(readQuery(req));
    sendJson(context, result.status, result.body);
  } catch (error) {
    context.log.error("Fractional catalog request failed.");
    sendJson(context, 500, {
      error: "Fractional catalog request failed.",
    });
  }
};
