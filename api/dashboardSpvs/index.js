const { getDashboardData } = require("../shared/dashboardDataService");
const { handleEndpointError, sendJson } = require("../shared/httpResponses");

module.exports = async function (context) {
  try {
    const data = await getDashboardData();
    sendJson(context, 200, data.spvs);
  } catch (error) {
    handleEndpointError(context, error);
  }
};
