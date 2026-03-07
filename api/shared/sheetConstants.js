const INVALID_NUMERIC_TOKENS = new Set([
  "",
  "-",
  "n/a",
  "na",
  "null",
  "undefined",
  "#div/0!",
  "#n/a",
  "#value!",
  "#ref!",
  "nan",
]);

const DEAL_HEADER_ALIASES = {
  dealId: ["dealid", "deal_id", "id", "dealnumber"],
  spvId: ["spvid", "spv_id", "spv", "spvname", "spvcode"],
  title: ["dealtitle", "title", "dealname", "name", "propertyname"],
  buyboxType: ["buyboxtype", "buybox", "lane", "type", "category"],
  status: ["status", "dealstatus", "opportunitystatus"],
  state: ["state", "propertystate", "locationstate", "dealstate"],
  capitalRequired: [
    "totalcapitalrequired",
    "capitalrequired",
    "capital",
    "requiredcapital",
    "targetcapital",
    "capitalneeded",
    "capitalrequiredusd",
  ],
  raised: ["totalraised", "raised", "capitalraised", "raisedamount", "funded"],
  unitsSold: ["unitssold", "soldunits", "sharessold"],
  unitsRemaining: ["unitsremaining", "remainingunits", "sharesremaining"],
  totalUnits: ["totalunits", "units", "totalshares", "offeredunits"],
  sentMail: ["sentmail", "sentmaildeal", "emailsent", "mailstatus"],
  propertyAddress: ["propertyaddress", "address", "assetaddress"],
  updatedAt: ["latestupdatedat", "updatedat", "lastupdated", "timestamp"],
};

const ORDER_HEADER_ALIASES = {
  orderId: ["orderid", "order_id", "id", "transactionid"],
  investorName: ["investorname", "investor", "fullname", "name"],
  investorEmail: ["investoremail", "email", "emailaddress"],
  spvId: ["spvid", "spv_id", "spv", "spvname", "spvcode"],
  spvName: ["spvname", "spv", "spv_id"],
  dealId: ["dealid", "deal_id"],
  units: ["units", "quantity", "shares", "unitcount"],
  amount: ["amount", "investmentamount", "orderamount", "raisedamount", "usd"],
  status: ["status", "orderstatus", "paymentstatus"],
  createdAt: ["createdat", "timestamp", "date", "submittedat"],
};

const SUMMARY_KEY_ALIASES = {
  totalDeals: ["totaldeals", "deals", "dealscount"],
  totalSPVs: ["totalspvs", "totalspv", "spvs", "spvcount"],
  activeDeals: ["activedeals", "openactivedeals"],
  sentMailDeals: ["sentmaildeals", "dealssentmail", "sentmail"],
  totalCapitalRequired: [
    "totalcapitalrequired",
    "capitalrequired",
    "capitalrequiredtotal",
  ],
  totalRaised: ["totalraised", "raisedtotal", "capitalraised"],
  unitsSold: ["unitssold", "soldunits", "sharessold"],
  unitsRemaining: ["unitsremaining", "remainingunits", "sharesremaining"],
  totalOrders: ["totalorders", "orders"],
  totalInvestors: ["totalinvestors", "investors", "investorcount"],
  latestUpdatedAt: ["latestupdatedat", "lastupdated", "updatedat", "timestamp"],
};

module.exports = {
  DEAL_HEADER_ALIASES,
  INVALID_NUMERIC_TOKENS,
  ORDER_HEADER_ALIASES,
  SUMMARY_KEY_ALIASES,
};
