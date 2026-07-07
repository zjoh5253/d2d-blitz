-- Fiber Blitz OS v2 — Sprint 5: Team Lead role (spec §3) for gate escalation.
-- Additive + idempotent. Postgres allows ADD VALUE outside a txn on PG12+.
--   prisma db execute --file prisma/migrations/20260630b_fbos_team_lead_role.sql

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TEAM_LEAD';
