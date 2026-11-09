UBUYBOX API (Primary Backend)

## Purpose
Primary backend Azure Functions app for UBUYBOX API endpoints.

## Deployment
- Workflow file: `.github/workflows/deploy-api.yml`
- Workflow name: `Deploy UBUYBOX API`
- Branch trigger: `main`
- Azure Function App target: `ubuybox-api-007011`

## Required GitHub Secrets
- `AZURE_CLIENT_ID_API`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

## Live Investor Data Endpoints
- `GET /api/dashboard/summary`
- `GET /api/dashboard/deals`
- `GET /api/dashboard/orders`
- `GET /api/dashboard/charts`
- `GET /api/dashboard/spvs`

## Fractional catalog
Read-only snapshot of the public Fractional Active and Past project directories. The endpoint serves the checked-in snapshot. It does not call Fractional and it does not write data.

- `GET /api/fractional/catalog`
- Optional query: `category` (`Active` or `Past`), `status` (displayed status, such as `Funded` or `118% Funded`), `limit`

Local check: `node scripts/test-fractional-catalog.js`

## Azure App Settings (Google Sheets)
- `GOOGLE_SHEET_ID`
- `GOOGLE_SHEETS_RANGE`

Optional (enables private sheet/service-account mode):
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

Optional override ranges (if you need separate tabs in future):
- `GOOGLE_SHEET_RANGE_DEALS`
- `GOOGLE_SHEET_RANGE_ORDERS`
- `GOOGLE_SHEET_RANGE_SUMMARY`
- `GOOGLE_SHEET_RANGE_CHARTS`
