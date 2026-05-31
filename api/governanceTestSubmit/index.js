const ALLOWED_FIELDS = new Set([
  "deal_id",
  "property_id",
  "property_type",
  "city",
  "state",
  "county",
  "asset_class",
  "governance_status",
  "protected_field_check",
  "approved_for_public",
  "visibility_level",
  "openclaw_status",
  "release_locked",
  "timestamp",
]);

const PROTECTED_FIELDS = [
  "property_address",
  "seller_name",
  "seller_phone",
  "seller_email",
  "owner_name",
  "owner_mailing_address",
  "apn",
  "parcel_number",
  "purchase_price",
  "contract_price",
  "private_notes",
  "review_notes",
];

function sendJson(context, status, body) {
  context.res = {
    status,
    headers: {
      "Content-Type": "application/json",
    },
    body,
  };
}

function getHeader(req, name) {
  if (!req || !req.headers) return "";
  if (typeof req.headers.get === "function") return req.headers.get(name) || "";
  return req.headers[name] || req.headers[name.toLowerCase()] || req.headers[name.toUpperCase()] || "";
}

async function getBody(req) {
  if (!req) return {};
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.json === "function") return req.json();
  if (typeof req.body === "string" && req.body.trim()) return JSON.parse(req.body);
  return {};
}

function hasValidAuthorization(req) {
  const token = process.env.OPENCLAW_API_TOKEN;
  const authorization = getHeader(req, "authorization");
  return Boolean(token && authorization === `Bearer ${token}`);
}

module.exports = async function (context, req) {
  if (!hasValidAuthorization(req)) {
    sendJson(context, 401, { status: "unauthorized" });
    return;
  }

  let payload;
  try {
    payload = await getBody(req);
  } catch (error) {
    sendJson(context, 400, { status: "rejected", reason: "invalid_json" });
    return;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    sendJson(context, 400, { status: "rejected", reason: "invalid_payload" });
    return;
  }

  for (const field of PROTECTED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      sendJson(context, 400, {
        status: "rejected",
        reason: "protected_field_detected",
        field,
      });
      return;
    }
  }

  for (const field of Object.keys(payload)) {
    if (!ALLOWED_FIELDS.has(field)) {
      sendJson(context, 400, {
        status: "rejected",
        reason: "field_not_allowed",
        field,
      });
      return;
    }
  }

  const serverTimestamp = new Date().toISOString();
  const responseBody = {
    status: "received",
    decision: "hold",
    reason: "Phase 1 test received. Governance not active.",
    deal_id: payload.deal_id || "",
    timestamp: serverTimestamp,
  };

  context.log({
    deal_id: payload.deal_id || "",
    property_id: payload.property_id || "",
    timestamp: serverTimestamp,
    status: responseBody.status,
    decision: responseBody.decision,
  });

  sendJson(context, 200, responseBody);
};

module.exports.ALLOWED_FIELDS = ALLOWED_FIELDS;
module.exports.PROTECTED_FIELDS = PROTECTED_FIELDS;
