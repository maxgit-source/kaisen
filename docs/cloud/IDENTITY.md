# Identity rules

## Slug
- lowercase
- only a-z, 0-9, hyphen
- max 40 chars
- derived from tenant name if not provided

## Token (one-time issuance)
- format: TL-<SLUG>-<RAND>-<RAND>
- example: TL-EL-TORNILLO-7F3A-9K2Q
- token is shown once, then only stored as SHA-256 hash
- use token_preview for UI (first 4 + last 4)

## Device ID
- local app sends device_id (HW-xxxxx) in /sync
- cloud stores device_id per tenant and updates last_seen_at
