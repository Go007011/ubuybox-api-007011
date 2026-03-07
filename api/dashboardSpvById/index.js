const { getDashboardData } = require("../shared/dashboardDataService");
const { handleEndpointError, sendJson } = require("../shared/httpResponses");

module.exports = async function (context, req) {
  try {
    const spvId = (req.params?.spvId || "").toString().trim().toLowerCase();
    const data = await getDashboardData();
    const match = data.spvs.find((spv) => spv.spvId.toLowerCase() === spvId);

    if (!match) {
      sendJson(context, 404, {
        error: "SPV not found.",
      });
      return;
    }

    sendJson(context, 200, match);
  } catch (error) {
    handleEndpointError(context, error);
  }
};
