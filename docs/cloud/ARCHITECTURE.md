# Cloud architecture (phase 1-2)

Goal: connect local SQLite ERP to a cloud catalog with a private admin panel and a public catalog per tenant.

## Actors
- Admin panel (you): creates tenants and issues a one-time token.
- Local ERP (client): stores token + endpoint, sends sync events.
- Cloud API: validates token, stores events, serves public catalog.
- Public catalog: read-only, per tenant slug.

## Flow
1) Admin creates tenant in the secret panel.
2) Panel generates a token (one time) + slug.
3) Client enters token in local app (cloud linking).
4) Local app sends events to cloud /api/sync with Bearer token.
5) Cloud stores events and updates catalog tables.
6) Public catalog is available at /<slug>.

## Security
- Token is never stored in plain text (hash only).
- Admin panel guarded by ADMIN_API_KEY or Supabase Auth.
- RLS enabled on Supabase (tenant_id isolation).

## Environments
- Local ERP: SQLite + token stored in parametros_sistema.
- Cloud: Supabase Postgres + Vercel serverless functions.
