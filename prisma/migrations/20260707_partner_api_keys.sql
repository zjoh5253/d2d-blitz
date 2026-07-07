-- Partner API keys for the Coastside two-way integration (and future partners).
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id"            TEXT PRIMARY KEY,
  "name"          TEXT NOT NULL,
  "key_prefix"    TEXT NOT NULL,
  "key_hash"      TEXT NOT NULL,
  "scopes"        TEXT[] NOT NULL DEFAULT '{}',
  "active"        BOOLEAN NOT NULL DEFAULT true,
  "last_used_at"  TIMESTAMP(3),
  "created_by_id" TEXT,
  "revoked_at"    TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_key_hash_key" ON "api_keys" ("key_hash");
CREATE INDEX IF NOT EXISTS "api_keys_active_idx" ON "api_keys" ("active");
