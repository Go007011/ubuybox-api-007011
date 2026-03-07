const { hasServiceAccountConfig } = require("../shared/googleSheetsClient");

module.exports = async function (context, req) {
  const requiredSheetVars = [
    "GOOGLE_SHEET_ID",
    "GOOGLE_SHEETS_RANGE",
  ];
  const missingVars = requiredSheetVars.filter(
    (name) => !process.env[name] || !process.env[name].toString().trim(),
  );

  context.res = {
    status: 200,
    body: {
      service: "UBUYBOX API",
      status: "running",
      sheetsReady: missingVars.length === 0,
      missingSheetConfig: missingVars,
      sheetsAuthMode: hasServiceAccountConfig() ? "service-account" : "public-gviz",
    },
  };
};
