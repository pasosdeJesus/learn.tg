# `db/` — Database Schema and Migrations

The Next.js app accesses PostgreSQL directly via Kysely ORM for performance-critical operations. Schema is managed by Rails migrations; this directory contains Kysely-specific migrations and type definitions.

| File | Purpose |
|------|---------|
| `database.ts` | Kysely connection factory (`getDb()`) with test spy support |
| `db.d.ts` | TypeScript types for all tables (`DB`, `Usuario`, `GuideUsuario`, etc.) |
| `structure.sql` | Full database schema dump |
| `migrations/` | 25 Kysely migrations (deployed after Rails schema changes) |

### Migration naming: `YYYYMMDDHHMMSS_description.ts`

Key migrations:
- `20251121001223_completed_guides_courses.ts` — Initial guide/course tracking
- `20251129013613_learningscore.ts` — Learning score system
- `20260317_create_transaction_table.ts` — Unified transaction table
- `20260424_create_site_nonces.ts` — Nonce tracking for ecosystem API

### Connection

Configured via `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` env vars (shared with Rails).
