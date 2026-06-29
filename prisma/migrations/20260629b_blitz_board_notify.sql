-- "Notify reps" broadcast timestamp for the rep job board.
-- Additive + idempotent. Apply via:
--   prisma db execute --file prisma/migrations/20260629b_blitz_board_notify.sql
--
-- board_notified_at: when a manager last pushed this blitz to reps. Manual /
-- explicit — opening a blitz for signup never auto-notifies.

ALTER TABLE "blitzes"
  ADD COLUMN IF NOT EXISTS "board_notified_at" timestamp(3);
