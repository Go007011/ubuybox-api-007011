const {
  DEAL_HEADER_ALIASES,
  INVALID_NUMERIC_TOKENS,
  ORDER_HEADER_ALIASES,
  SUMMARY_KEY_ALIASES,
} = require("./sheetConstants");

const DEAL_STATUS_MAP = {
  new: "New",
  underreview: "Under Review",
  open: "Open",
  closing: "Closing",
  funded: "Funded",
  onhold: "On Hold",
};

const ORDER_STATUS_MAP = {
  confirmed: "Confirmed",
  pending: "Pending",
  settled: "Settled",
};

function cleanCell(value) {
  return (value ?? "").toString().trim();
}

function normalizeHeader(value) {
  return cleanCell(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isNonEmptyRow(row) {
  return Array.isArray(row) && row.some((cell) => cleanCell(cell) !== "");
}

function isLikelyRepeatedHeader(row, headerSet) {
  const rowHeaders = row
    .map((cell) => normalizeHeader(cell))
    .filter((value) => value.length > 0);

  if (rowHeaders.length === 0) {
    return false;
  }

  let matches = 0;
  for (const header of rowHeaders) {
    if (headerSet.has(header)) {
      matches += 1;
    }
  }

  return matches >= Math.min(3, Math.max(2, headerSet.size));
}

function buildAliasIndex(aliases) {
  const aliasIndex = {};
  Object.entries(aliases).forEach(([targetKey, aliasList]) => {
    aliasList.forEach((alias) => {
      aliasIndex[alias] = targetKey;
    });
  });
  return aliasIndex;
}

const SUMMARY_ALIAS_INDEX = buildAliasIndex(SUMMARY_KEY_ALIASES);

function extractTable(values, warnings, label) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const headerIndex = values.findIndex((row) => isNonEmptyRow(row));
  if (headerIndex < 0) {
    return null;
  }

  const headerRow = values[headerIndex];
  const normalizedHeaders = headerRow.map((header) => normalizeHeader(header));
  const headerSet = new Set(normalizedHeaders.filter(Boolean));
  const indexByHeader = {};

  normalizedHeaders.forEach((header, index) => {
    if (header && indexByHeader[header] === undefined) {
      indexByHeader[header] = index;
    }
  });

  const rows = [];
  values.slice(headerIndex + 1).forEach((row, relativeIndex) => {
    if (!isNonEmptyRow(row)) {
      return;
    }

    if (isLikelyRepeatedHeader(row, headerSet)) {
      warnings.push(
        `${label}: skipped repeated header section at row ${headerIndex + relativeIndex + 2}.`,
      );
      return;
    }

    rows.push(row);
  });

  return {
    headers: normalizedHeaders,
    indexByHeader,
    rows,
  };
}

function getFieldValue(row, indexByHeader, aliases) {
  for (const alias of aliases) {
    const index = indexByHeader[alias];
    if (index === undefined) {
      continue;
    }
    const value = cleanCell(row[index]);
    if (value !== "") {
      return value;
    }
  }

  return "";
}

function parseNumber(rawValue) {
  const value = cleanCell(rawValue);
  if (value === "") {
    return null;
  }

  const lowered = value.toLowerCase();
  if (INVALID_NUMERIC_TOKENS.has(lowered)) {
    return null;
  }

  const sanitized = value
    .replace(/[$,%\s]/g, "")
    .replace(/,/g, "")
    .replace(/[()]/g, "");
  const parsed = Number.parseFloat(sanitized);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(rawValue) {
  const value = cleanCell(rawValue).toLowerCase();
  if (!value) {
    return false;
  }

  return ["true", "yes", "y", "sent", "1", "done"].includes(value);
}

function parseIsoDate(rawValue) {
  const value = cleanCell(rawValue);
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? "" : parsed.toISOString();
}

function normalizeDealStatus(rawStatus) {
  const normalized = normalizeHeader(rawStatus);
  return DEAL_STATUS_MAP[normalized] || "";
}

function normalizeOrderStatus(rawStatus) {
  const normalized = normalizeHeader(rawStatus);
  return ORDER_STATUS_MAP[normalized] || "";
}

function normalizeState(rawState) {
  return cleanCell(rawState).toUpperCase();
}

function inferBuyboxType(rawType, titleValue, spvValue) {
  const composite = `${rawType} ${titleValue} ${spvValue}`.toLowerCase();
  if (composite.includes("boot")) {
    return "Boot Camp";
  }
  if (
    composite.includes("property") ||
    composite.includes("real estate") ||
    composite.includes("asset")
  ) {
    return "Property";
  }
  return "Business";
}

function dedupeWarnings(warnings) {
  return [...new Set(warnings)];
}

function collectDuplicates(items, keyName, warningLabel, warnings) {
  const counts = new Map();
  items.forEach((item) => {
    const value = cleanCell(item[keyName]);
    if (!value) {
      return;
    }
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  for (const [value, count] of counts.entries()) {
    if (count > 1) {
      warnings.push(`${warningLabel}: ${value} appears ${count} times.`);
    }
  }
}

function parseDeals(values, warnings) {
  const table = extractTable(values, warnings, "deals");
  if (!table) {
    return [];
  }

  const deals = [];
  table.rows.forEach((row, index) => {
    const rawDealId = getFieldValue(row, table.indexByHeader, DEAL_HEADER_ALIASES.dealId);
    const rawSpvId = getFieldValue(row, table.indexByHeader, DEAL_HEADER_ALIASES.spvId);
    const rawTitle = getFieldValue(row, table.indexByHeader, DEAL_HEADER_ALIASES.title);
    const rawType = getFieldValue(row, table.indexByHeader, DEAL_HEADER_ALIASES.buyboxType);
    const rawStatus = getFieldValue(row, table.indexByHeader, DEAL_HEADER_ALIASES.status);
    const rawState = getFieldValue(row, table.indexByHeader, DEAL_HEADER_ALIASES.state);
    const rawCapital = getFieldValue(
      row,
      table.indexByHeader,
      DEAL_HEADER_ALIASES.capitalRequired,
    );
    const rawRaised = getFieldValue(row, table.indexByHeader, DEAL_HEADER_ALIASES.raised);
    const rawUnitsSold = getFieldValue(row, table.indexByHeader, DEAL_HEADER_ALIASES.unitsSold);
    const rawUnitsRemaining = getFieldValue(
      row,
      table.indexByHeader,
      DEAL_HEADER_ALIASES.unitsRemaining,
    );
    const rawTotalUnits = getFieldValue(row, table.indexByHeader, DEAL_HEADER_ALIASES.totalUnits);
    const rawSentMail = getFieldValue(row, table.indexByHeader, DEAL_HEADER_ALIASES.sentMail);
    const rawAddress = getFieldValue(
      row,
      table.indexByHeader,
      DEAL_HEADER_ALIASES.propertyAddress,
    );
    const rawUpdated = getFieldValue(row, table.indexByHeader, DEAL_HEADER_ALIASES.updatedAt);

    const dealId = rawDealId || `deal-${index + 1}`;
    const spvId = rawSpvId || dealId;
    const title = rawTitle || spvId || `Deal ${index + 1}`;
    const status = normalizeDealStatus(rawStatus);
    const state = normalizeState(rawState);
    const capitalRequired = parseNumber(rawCapital);
    const raised = parseNumber(rawRaised);
    const unitsSold = parseNumber(rawUnitsSold);
    const explicitUnitsRemaining = parseNumber(rawUnitsRemaining);
    const totalUnits = parseNumber(rawTotalUnits);
    const updatedAt = parseIsoDate(rawUpdated);
    const sentMail = parseBoolean(rawSentMail);
    const buyboxType = inferBuyboxType(rawType, title, spvId);

    if (!status) {
      warnings.push(`deals: ${dealId} is missing a valid status.`);
    }
    if (capitalRequired === null) {
      warnings.push(`deals: ${dealId} has missing/invalid capital required.`);
    }

    const soldValue = unitsSold ?? 0;
    let unitsRemaining =
      explicitUnitsRemaining !== null
        ? explicitUnitsRemaining
        : totalUnits !== null
        ? totalUnits - soldValue
        : 0;

    if (totalUnits !== null && soldValue > totalUnits) {
      warnings.push(`deals: ${dealId} has units sold greater than total units.`);
    }
    if (unitsRemaining < 0) {
      unitsRemaining = 0;
    }

    deals.push({
      id: dealId,
      dealId,
      spvId,
      title,
      buyboxType,
      status: status || "Under Review",
      state,
      propertyAddress: rawAddress,
      capitalRequired: capitalRequired ?? 0,
      raised: raised ?? 0,
      unitsSold: soldValue,
      unitsRemaining,
      totalUnits: totalUnits ?? soldValue + unitsRemaining,
      sentMail,
      updatedAt,
    });
  });

  collectDuplicates(deals, "dealId", "Duplicate Deal_ID", warnings);
  collectDuplicates(deals, "spvId", "Duplicate SPV_ID", warnings);

  return deals;
}

function parseOrders(values, warnings) {
  const table = extractTable(values, warnings, "orders");
  if (!table) {
    return [];
  }

  return table.rows.map((row, index) => {
    const rawOrderId = getFieldValue(row, table.indexByHeader, ORDER_HEADER_ALIASES.orderId);
    const rawInvestorName = getFieldValue(
      row,
      table.indexByHeader,
      ORDER_HEADER_ALIASES.investorName,
    );
    const rawInvestorEmail = getFieldValue(
      row,
      table.indexByHeader,
      ORDER_HEADER_ALIASES.investorEmail,
    );
    const rawSpvId = getFieldValue(row, table.indexByHeader, ORDER_HEADER_ALIASES.spvId);
    const rawSpvName = getFieldValue(row, table.indexByHeader, ORDER_HEADER_ALIASES.spvName);
    const rawDealId = getFieldValue(row, table.indexByHeader, ORDER_HEADER_ALIASES.dealId);
    const rawUnits = getFieldValue(row, table.indexByHeader, ORDER_HEADER_ALIASES.units);
    const rawAmount = getFieldValue(row, table.indexByHeader, ORDER_HEADER_ALIASES.amount);
    const rawStatus = getFieldValue(row, table.indexByHeader, ORDER_HEADER_ALIASES.status);
    const rawCreatedAt = getFieldValue(row, table.indexByHeader, ORDER_HEADER_ALIASES.createdAt);

    const orderId = rawOrderId || `order-${index + 1}`;
    const units = parseNumber(rawUnits) ?? 0;
    const amount = parseNumber(rawAmount) ?? 0;
    const status = normalizeOrderStatus(rawStatus) || "Pending";
    const createdAt = parseIsoDate(rawCreatedAt) || new Date().toISOString();

    return {
      id: orderId,
      orderId,
      investorName: rawInvestorName || "Unknown Investor",
      investorEmail: rawInvestorEmail,
      spvId: rawSpvId || rawSpvName,
      spvName: rawSpvName || rawSpvId || "Unknown SPV",
      dealId: rawDealId,
      units,
      amount,
      status,
      createdAt,
    };
  });
}

function parseSummary(values) {
  const parsed = {};

  if (!Array.isArray(values) || values.length === 0) {
    return parsed;
  }

  values.forEach((row) => {
    if (!isNonEmptyRow(row)) {
      return;
    }

    const key = normalizeHeader(row[0]);
    const canonical = SUMMARY_ALIAS_INDEX[key];
    if (!canonical) {
      return;
    }

    if (canonical === "latestUpdatedAt") {
      const timestamp = parseIsoDate(row[1]);
      if (timestamp) {
        parsed.latestUpdatedAt = timestamp;
      }
      return;
    }

    const numeric = parseNumber(row[1]);
    if (numeric !== null) {
      parsed[canonical] = numeric;
    }
  });

  const table = extractTable(values, [], "summary");
  if (!table || table.rows.length === 0) {
    return parsed;
  }

  const firstDataRow = table.rows[0];
  Object.keys(SUMMARY_KEY_ALIASES).forEach((summaryKey) => {
    const aliases = SUMMARY_KEY_ALIASES[summaryKey];
    const rawValue = getFieldValue(firstDataRow, table.indexByHeader, aliases);
    if (!rawValue) {
      return;
    }

    if (summaryKey === "latestUpdatedAt") {
      const timestamp = parseIsoDate(rawValue);
      if (timestamp) {
        parsed.latestUpdatedAt = timestamp;
      }
      return;
    }

    const numeric = parseNumber(rawValue);
    if (numeric !== null) {
      parsed[summaryKey] = numeric;
    }
  });

  return parsed;
}

function parseChartsOverrides(values, warnings) {
  const table = extractTable(values, warnings, "charts");
  if (!table) {
    return {};
  }

  const metricAliases = ["metric", "chart", "series", "type"];
  const labelAliases = ["label", "name", "category"];
  const valueAliases = ["value", "amount", "count"];
  const metricData = {};

  table.rows.forEach((row) => {
    const metric = normalizeHeader(getFieldValue(row, table.indexByHeader, metricAliases));
    const label = getFieldValue(row, table.indexByHeader, labelAliases);
    const value = parseNumber(getFieldValue(row, table.indexByHeader, valueAliases));

    if (!metric || !label || value === null) {
      return;
    }

    if (!metricData[metric]) {
      metricData[metric] = [];
    }
    metricData[metric].push({ label, value });
  });

  const overrides = {};
  if (metricData.capitalrequiredbyspv) {
    overrides.capitalRequiredBySpv = metricData.capitalrequiredbyspv;
  }
  if (metricData.totalraisedbyspv) {
    overrides.totalRaisedBySpv = metricData.totalraisedbyspv;
  }
  if (metricData.unitssoldvsremaining) {
    overrides.unitsSoldVsRemaining = metricData.unitssoldvsremaining;
  }
  if (metricData.dealsbystate) {
    overrides.dealsByState = metricData.dealsbystate;
    overrides.stateDistribution = metricData.dealsbystate;
  }
  if (metricData.dealsbystatus) {
    overrides.dealsByStatus = metricData.dealsbystatus;
    overrides.statusDistribution = metricData.dealsbystatus;
  }
  if (metricData.monthlyinvestmentvolume) {
    overrides.monthlyInvestmentVolume = metricData.monthlyinvestmentvolume;
  }
  if (metricData.fundingprogressbydeal) {
    overrides.fundingProgressByDeal = metricData.fundingprogressbydeal;
  }

  return overrides;
}

function sumBy(items, selector) {
  return items.reduce((acc, item) => acc + selector(item), 0);
}

function buildDistribution(items, keySelector) {
  const counts = new Map();
  items.forEach((item) => {
    const key = cleanCell(keySelector(item)) || "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}

function buildFundingProgressByLane(deals) {
  const grouped = new Map();

  deals.forEach((deal) => {
    const key = deal.buyboxType || "Business";
    const current = grouped.get(key) || {
      required: 0,
      raised: 0,
    };
    current.required += deal.capitalRequired;
    current.raised += deal.raised;
    grouped.set(key, current);
  });

  return [...grouped.entries()].map(([label, values]) => ({
    label,
    value:
      values.required > 0 ? Number(((values.raised / values.required) * 100).toFixed(2)) : 0,
  }));
}

function buildMonthlyInvestmentVolume(orders) {
  const monthly = new Map();

  orders.forEach((order) => {
    const parsed = new Date(order.createdAt);
    if (Number.isNaN(parsed.valueOf())) {
      return;
    }

    const monthKey = `${parsed.getUTCFullYear()}-${String(
      parsed.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    monthly.set(monthKey, (monthly.get(monthKey) || 0) + order.amount);
  });

  return [...monthly.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));
}

function buildSpvs(deals, orders) {
  const grouped = new Map();

  deals.forEach((deal) => {
    const spvId = deal.spvId || deal.id;
    const current = grouped.get(spvId) || {
      spvId,
      deals: [],
    };
    current.deals.push(deal);
    grouped.set(spvId, current);
  });

  return [...grouped.values()].map((group) => {
    const dealIds = [...new Set(group.deals.map((deal) => deal.dealId))];
    const capitalRequired = sumBy(group.deals, (deal) => deal.capitalRequired);
    const totalRaised = sumBy(group.deals, (deal) => deal.raised);
    const unitsSold = sumBy(group.deals, (deal) => deal.unitsSold);
    const unitsRemaining = sumBy(group.deals, (deal) => deal.unitsRemaining);
    const fundingProgressPercent =
      capitalRequired > 0 ? Number(((totalRaised / capitalRequired) * 100).toFixed(2)) : 0;
    const stateMix = {};
    group.deals.forEach((deal) => {
      const state = deal.state || "Unknown";
      stateMix[state] = (stateMix[state] || 0) + 1;
    });

    const matchingOrders = orders.filter((order) => {
      if (!order.spvId && !order.spvName) {
        return false;
      }
      return (
        cleanCell(order.spvId).toLowerCase() === group.spvId.toLowerCase() ||
        cleanCell(order.spvName).toLowerCase() === group.spvId.toLowerCase()
      );
    });

    const uniqueInvestors = new Set(
      matchingOrders.map((order) => (order.investorEmail || order.investorName).toLowerCase()),
    );
    const primaryDeal = group.deals[0] || {};

    return {
      id: group.spvId,
      name: group.spvId,
      dealCount: group.deals.length,
      capitalRequired,
      totalRaised,
      stateMix,
      spvId: group.spvId,
      dealId: dealIds.length === 1 ? dealIds[0] : dealIds.join(", "),
      status:
        group.deals.length === 1
          ? primaryDeal.status
          : [...new Set(group.deals.map((deal) => deal.status))].join(", "),
      totalCapitalRequired: capitalRequired,
      fundingProgressPercent,
      unitsSold,
      unitsRemaining,
      investorCount: uniqueInvestors.size,
      state: primaryDeal.state || "",
      propertyAddress: primaryDeal.propertyAddress || "",
    };
  });
}

function findLatestTimestamp(deals, orders, summaryTimestamp) {
  if (summaryTimestamp) {
    return summaryTimestamp;
  }

  const timestamps = [
    ...deals.map((deal) => deal.updatedAt),
    ...orders.map((order) => order.createdAt),
  ].filter(Boolean);

  if (timestamps.length === 0) {
    return new Date().toISOString();
  }

  return timestamps
    .map((timestamp) => new Date(timestamp))
    .filter((date) => !Number.isNaN(date.valueOf()))
    .sort((a, b) => b.valueOf() - a.valueOf())[0]
    .toISOString();
}

function buildSummary({ deals, orders, spvs, summaryFromSheet, warnings }) {
  const totalDeals = summaryFromSheet.totalDeals ?? deals.length;
  const totalSPVs = summaryFromSheet.totalSPVs ?? spvs.length;
  const activeDeals =
    summaryFromSheet.activeDeals ??
    deals.filter((deal) => ["Open", "Under Review", "Closing", "New"].includes(deal.status))
      .length;
  const sentMailDeals =
    summaryFromSheet.sentMailDeals ?? deals.filter((deal) => deal.sentMail).length;
  const totalCapitalRequired =
    summaryFromSheet.totalCapitalRequired ?? sumBy(deals, (deal) => deal.capitalRequired);
  const totalRaised = summaryFromSheet.totalRaised ?? sumBy(deals, (deal) => deal.raised);
  const unitsSold = summaryFromSheet.unitsSold ?? sumBy(deals, (deal) => deal.unitsSold);
  const unitsRemaining =
    summaryFromSheet.unitsRemaining ?? sumBy(deals, (deal) => deal.unitsRemaining);
  const totalOrders = summaryFromSheet.totalOrders ?? orders.length;
  const totalInvestors =
    summaryFromSheet.totalInvestors ??
    new Set(
      orders.map((order) => (order.investorEmail || order.investorName).toLowerCase()),
    ).size;
  const latestUpdatedAt = findLatestTimestamp(deals, orders, summaryFromSheet.latestUpdatedAt);
  const fundingProgressPercent =
    totalCapitalRequired > 0 ? Number(((totalRaised / totalCapitalRequired) * 100).toFixed(2)) : 0;

  return {
    totalDeals,
    totalSPVs,
    totalSpvs: totalSPVs,
    activeDeals,
    sentMailDeals,
    totalCapitalRequired,
    capitalRequired: totalCapitalRequired,
    totalRaised,
    unitsSold,
    unitsRemaining,
    totalOrders,
    totalInvestors,
    latestUpdatedAt,
    lastUpdated: latestUpdatedAt,
    fundingProgressPercent,
    warnings: dedupeWarnings(warnings),
  };
}

function buildCharts({ deals, orders, spvs, chartOverrides }) {
  const totalUnitsSold = sumBy(deals, (deal) => deal.unitsSold);
  const totalUnitsRemaining = sumBy(deals, (deal) => deal.unitsRemaining);
  const dealsByState = buildDistribution(deals, (deal) => deal.state);
  const dealsByStatus = buildDistribution(deals, (deal) => deal.status);

  const baseCharts = {
    capitalRequiredBySpv: spvs.map((spv) => ({
      label: spv.spvId,
      value: spv.totalCapitalRequired,
    })),
    totalRaisedBySpv: spvs.map((spv) => ({
      label: spv.spvId,
      value: spv.totalRaised,
    })),
    unitsSoldVsRemaining: [
      { label: "Units Sold", value: totalUnitsSold },
      { label: "Units Remaining", value: totalUnitsRemaining },
    ],
    dealsByState,
    dealsByStatus,
    monthlyInvestmentVolume: buildMonthlyInvestmentVolume(orders),
    fundingProgressByDeal: buildFundingProgressByLane(deals),
    stateDistribution: dealsByState,
    statusDistribution: dealsByStatus,
  };

  return {
    ...baseCharts,
    ...chartOverrides,
  };
}

function normalizeDashboardData(rawValues) {
  const warnings = [];
  const deals = parseDeals(rawValues.deals, warnings);
  const orders = parseOrders(rawValues.orders, warnings);
  const spvs = buildSpvs(deals, orders);
  const summaryFromSheet = parseSummary(rawValues.summary);
  const chartOverrides = parseChartsOverrides(rawValues.charts, warnings);
  const summary = buildSummary({
    deals,
    orders,
    spvs,
    summaryFromSheet,
    warnings,
  });
  const charts = buildCharts({
    deals,
    orders,
    spvs,
    chartOverrides,
  });

  return {
    summary,
    deals,
    orders,
    spvs,
    charts,
    warnings: summary.warnings,
  };
}

module.exports = {
  normalizeDashboardData,
};
