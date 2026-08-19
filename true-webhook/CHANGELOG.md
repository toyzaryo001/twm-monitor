# Changelog

## 1.0.1 - 2026-08-19

### Security

- Updated production dependencies and resolved all production audit findings.
- Added request rate limits and baseline HTTP security headers.
- Disabled local JGA88 authentication mode in production and removed embedded production-capable credentials.
- Added production runtime validation for database and JWT configuration.
- Restricted wallet mutations and secret access to network administrators.
- Prevented cross-network wallet access by account ID.
- Protected initial Master setup with a one-time setup secret.
- Prevented deleting the active Master user or the final Master account.
- Changed network deletion to a non-destructive archive operation.

### Reliability

- Prevented overlapping balance checks for the same network.
- Disabled the balance worker automatically on the Master service.
- Added worker freshness details to deep health checks.
- Fixed shutdown cleanup for worker refresh timers and long-lived connections.
- Made fallback webhook transaction IDs deterministic for idempotency.
- Prevented duplicate webhook header keys within the same network.
- Made payment approval and rejection safe against concurrent processing.
- Added image content validation and Cloudinary cleanup for failed payment requests.

### Data correctness

- Fixed balance snapshot changes being calculated across different wallets.
- Limited fee reporting to explicit fee fields or verified fee events.
- Kept inferred balance changes separate from exact webhook transactions.

### Operations

- Added build metadata to the version endpoint and Tenant settings.
- Added an automated CI gate for audit, lint, and production build.
