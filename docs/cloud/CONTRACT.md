# Cloud API contract (phase 1-2)

Base URL (cloud): https://<cloud-host>

## Admin (secret panel)

### POST /api/admin/tenants
Creates a tenant and issues a one-time token.

Body:
{
  "name": "Ferreteria El Tornillo",
  "slug": "el-tornillo" (optional)
}

Response:
{
  "tenant_id": "uuid",
  "slug": "el-tornillo",
  "token": "TL-EL-TORNILLO-XXXX-YYYY",
  "token_preview": "TL-EL-***-YYYY"
}

### POST /api/admin/tenants/:id/rotate-token
Revokes previous token and returns a new one.

## Sync (from local ERP)

### POST /api/sync
Auth: Authorization: Bearer <token>

Body:
{
  "device_id": "HW-ABC123...",
  "events": [
    {
      "id": 123,
      "entity": "catalogo_producto",
      "entity_id": 10,
      "action": "upsert",
      "payload": { ... },
      "created_at": "2026-01-27T12:00:00Z"
    }
  ]
}

Response (minimal v1):
{
  "accepted": [123],
  "rejected": []
}

### POST /api/sync/snapshot
Auth: Authorization: Bearer <token>

Body:
{
  "config": { ... },
  "categorias": [ ... ],
  "productos": [ ... ]
}

Response:
{ "ok": true }

## Public catalog

### GET /api/public/:slug/catalog
Response:
{
  "config": { ... },
  "destacado": { ... } | null,
  "categorias": [ ... ],
  "productos": [ ... ]
}

### GET /:slug
Public catalog page (SSR/SPA).
