const snapshot = require("../data/fractional-catalog.json");

const CATEGORIES = new Set(["Active", "Past"]);

function canonicalProjectUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) {
    throw new Error("Project URL is empty.");
  }
  const withHost = raw.startsWith("/") ? `https://www.fractional.app${raw}` : raw;
  const url = new URL(withHost);
  const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "p" || !parts[1]) {
    throw new Error("Project URL is not a Fractional project path.");
  }
  return `https://www.fractional.app/p/${parts[1]}`;
}

function statusLabel(status) {
  const match = String(status || "").trim().match(/(\d+%\s+)?(.+)$/);
  return match ? match[2].trim() : String(status || "").trim();
}

function dedupeProjects(projects) {
  const byUrl = new Map();
  for (const project of projects) {
    const sourceUrl = canonicalProjectUrl(project.sourceUrl);
    const record = {
      name: project.name,
      sourceUrl,
      category: project.category,
      status: project.status,
      scannedAt: project.scannedAt,
    };
    const existing = byUrl.get(sourceUrl);
    if (!existing) {
      byUrl.set(sourceUrl, record);
      continue;
    }
    if (existing.category !== "Active" && record.category === "Active") {
      byUrl.set(sourceUrl, record);
    }
  }
  return Array.from(byUrl.values());
}

function readQuery(req) {
  if (!req || !req.query || typeof req.query !== "object") {
    return {};
  }
  return req.query;
}

function matchesStatus(project, statusQuery) {
  if (!statusQuery) return true;
  const query = String(statusQuery).trim().toLowerCase();
  if (!query) return true;
  const displayed = String(project.status || "").trim().toLowerCase();
  return displayed === query || statusLabel(project.status).toLowerCase() === query;
}

function getCatalogResponse(query) {
  const category = query && query.category ? String(query.category).trim() : "";
  const status = query && query.status ? String(query.status).trim() : "";
  const limitRaw = query && query.limit != null ? String(query.limit).trim() : "";

  if (category && !CATEGORIES.has(category)) {
    return {
      status: 400,
      body: {
        error: "category must be Active or Past.",
      },
    };
  }

  let limit = null;
  if (limitRaw) {
    if (!/^[1-9]\d*$/.test(limitRaw)) {
      return {
        status: 400,
        body: {
          error: "limit must be a positive integer.",
        },
      };
    }
    limit = Number(limitRaw);
  }

  const projects = dedupeProjects(snapshot.projects || []);
  let returned = projects;
  if (category) {
    returned = returned.filter((project) => project.category === category);
  }
  if (status) {
    returned = returned.filter((project) => matchesStatus(project, status));
  }
  if (limit != null) {
    returned = returned.slice(0, limit);
  }

  const countCategory = (name) => projects.filter((project) => project.category === name).length;

  return {
    status: 200,
    body: {
      service: "UBUYBOX API",
      catalog: "fractional-projects",
      readOnly: true,
      scannedAt: snapshot.scannedAt,
      coverage: snapshot.coverage,
      counts: {
        catalog: projects.length,
        active: countCategory("Active"),
        past: countCategory("Past"),
        returned: returned.length,
      },
      projects: returned,
    },
  };
}

module.exports = {
  canonicalProjectUrl,
  dedupeProjects,
  getCatalogResponse,
  readQuery,
  statusLabel,
};
