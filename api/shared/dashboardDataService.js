const { readDashboardRanges } = require("./googleSheetsClient");
const { normalizeDashboardData } = require("./dashboardNormalizer");

async function getDashboardData() {
  const { ranges, values } = await readDashboardRanges();
  const normalized = normalizeDashboardData(values);

  return {
    ...normalized,
    sourceRanges: ranges,
  };
}

module.exports = {
  getDashboardData,
};
