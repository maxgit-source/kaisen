# Supabase schema (phase 1-2)

Use Postgres in Supabase. Enable RLS and tenant isolation by tenant_id.

## tenants
- id uuid pk default gen_random_uuid()
- name text not null
- slug text not null unique
- status text not null default 'active'
- created_at timestamptz not null default now()

## tenant_tokens
- id uuid pk default gen_random_uuid()
- tenant_id uuid not null references tenants(id) on delete cascade
- token_hash text not null unique
- token_preview text not null
- created_at timestamptz not null default now()
- revoked_at timestamptz null
- last_used_at timestamptz null

## tenant_devices
- id uuid pk default gen_random_uuid()
- tenant_id uuid not null references tenants(id) on delete cascade
- device_id text not null
- linked_at timestamptz not null default now()
- last_seen_at timestamptz null
- unique (tenant_id, device_id)

## catalog_config
- tenant_id uuid pk references tenants(id) on delete cascade
- nombre text
- logo_url text
- destacado_producto_id bigint null
- publicado boolean not null default true
- price_type text not null default 'final'
- updated_at timestamptz not null default now()

## catalog_categories
- id bigint generated always as identity pk
- tenant_id uuid not null references tenants(id) on delete cascade
- external_id bigint
- name text not null
- image_url text
- description text
- active boolean not null default true
- updated_at timestamptz not null default now()
- unique (tenant_id, id)

## catalog_products
- id bigint generated always as identity pk
- tenant_id uuid not null references tenants(id) on delete cascade
- external_id bigint
- category_id bigint not null
- name text not null
- description text
- price numeric(18,2)
- price_local numeric(18,2)
- price_distribuidor numeric(18,2)
- precio_final numeric(18,2)
- image_url text
- active boolean not null default true
- updated_at timestamptz not null default now()
- unique (tenant_id, id)

Notes:
- Add unique indexes on (tenant_id, external_id) for upserts.

## sync_events
- id bigserial pk
- tenant_id uuid not null references tenants(id) on delete cascade
- device_id text
- local_event_id bigint
- entity text not null
- entity_id bigint
- action text not null
- payload jsonb
- created_at timestamptz not null default now()
- unique (tenant_id, device_id, local_event_id)

## audit_log
- id bigserial pk
- tenant_id uuid
- actor text
- action text
- meta jsonb
- created_at timestamptz not null default now()

Notes:
- catalog_* ids can mirror local ids or use external_id field if you prefer.
- if you want strict idempotency, keep local_event_id unique per tenant+device.
