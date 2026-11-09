const assert = require("assert");
const handler = require("../api/fractionalCatalog");
const {
  canonicalProjectUrl,
  dedupeProjects,
  getCatalogResponse,
} = require("../api/shared/fractionalCatalog");

function invoke(query) {
  const context = { log: { error() {} }, res: null };
  return handler(context, { query: query || {} }).then(() => context.res);
}

async function main() {
  const all = getCatalogResponse({});
  assert.strictEqual(all.status, 200);
  assert.strictEqual(all.body.readOnly, true);
  assert.strictEqual(all.body.counts.catalog, 49);
  assert.strictEqual(all.body.counts.active, 15);
  assert.strictEqual(all.body.counts.past, 34);
  assert.strictEqual(all.body.counts.returned, 49);
  assert.strictEqual(all.body.coverage.active.coverage, "complete");
  assert.strictEqual(all.body.coverage.past.coverage, "complete");
  assert.strictEqual(all.body.coverage.active.accessBarrier, null);
  assert.strictEqual(all.body.coverage.past.accessBarrier, null);

  const urls = all.body.projects.map((project) => project.sourceUrl);
  assert.strictEqual(new Set(urls).size, urls.length);

  for (const project of all.body.projects) {
    assert.ok(project.name);
    assert.strictEqual(project.sourceUrl, canonicalProjectUrl(project.sourceUrl));
    assert.ok(project.category === "Active" || project.category === "Past");
    assert.match(project.status, /^\d+% Funded$/);
    assert.match(project.scannedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.strictEqual(JSON.stringify(project).includes("NOTTE"), false);
  }

  const collective = all.body.projects.find(
    (project) => project.sourceUrl === "https://www.fractional.app/p/01KP9HPEYSAXTTN567K20AXPY7",
  );
  assert.ok(collective);
  assert.strictEqual(collective.name, "The Collective Co-Living Club - Atlanta");
  assert.strictEqual(collective.category, "Active");
  assert.strictEqual(collective.status, "118% Funded");

  const fundedActive = getCatalogResponse({ category: "Active", status: "Funded" });
  assert.strictEqual(fundedActive.status, 200);
  assert.strictEqual(fundedActive.body.counts.returned, 15);
  assert.ok(fundedActive.body.projects.every((project) => project.category === "Active"));
  assert.ok(fundedActive.body.projects.some((project) => project.status === "93% Funded"));

  const one = getCatalogResponse({ status: "157% Funded", limit: "1" });
  assert.strictEqual(one.body.counts.returned, 1);
  assert.strictEqual(one.body.projects[0].name, "The TELOS Capital Club");
  assert.strictEqual(one.body.projects[0].category, "Past");

  assert.strictEqual(getCatalogResponse({ category: "Drafts" }).status, 400);
  assert.strictEqual(getCatalogResponse({ limit: "0" }).status, 400);

  const deduped = dedupeProjects([
    {
      name: "Example",
      sourceUrl: "https://www.fractional.app/p/01KP9HPEYSAXTTN567K20AXPY7?ref=ad",
      category: "Past",
      status: "100% Funded",
      scannedAt: "2026-11-09T02:18:44Z",
    },
    {
      name: "The Collective Co-Living Club - Atlanta",
      sourceUrl: "https://www.fractional.app/p/01KP9HPEYSAXTTN567K20AXPY7/",
      category: "Active",
      status: "118% Funded",
      scannedAt: "2026-11-09T02:15:42Z",
    },
  ]);
  assert.strictEqual(deduped.length, 1);
  assert.strictEqual(deduped[0].category, "Active");
  assert.strictEqual(deduped[0].sourceUrl, "https://www.fractional.app/p/01KP9HPEYSAXTTN567K20AXPY7");

  const http = await invoke({ category: "Past", limit: "2" });
  assert.strictEqual(http.status, 200);
  assert.strictEqual(http.headers["Content-Type"], "application/json");
  assert.strictEqual(http.body.projects.length, 2);
  assert.ok(http.body.projects.every((project) => project.category === "Past"));

  console.log(JSON.stringify({
    ok: true,
    catalog: all.body.counts.catalog,
    active: all.body.counts.active,
    past: all.body.counts.past,
    activeCoverage: all.body.coverage.active.coverage,
    pastCoverage: all.body.coverage.past.coverage,
  }));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
