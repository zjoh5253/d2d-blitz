-- Persist rep-assignment planner drafts so an admin can iterate over
-- multiple plans without losing work between sessions.
--
-- One blitz can have multiple plans (admin drafts a few, picks one to
-- apply). Plans are immutable once `applied_at` is set so we have a
-- history of what was rolled out.

CREATE TABLE IF NOT EXISTS blitz_assignment_plans (
  id              TEXT PRIMARY KEY,
  blitz_id        TEXT NOT NULL,
  name            TEXT NOT NULL,
  num_reps        INTEGER NOT NULL,
  num_days        INTEGER,
  -- Snapshot of cluster → rep mapping at save time:
  --   [{ clusterIdx, repId, leadIds: [...] }, ...]
  assignments     JSONB NOT NULL,
  created_by_id   TEXT NOT NULL,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  applied_at      TIMESTAMP(3),
  CONSTRAINT blitz_assignment_plans_blitz_fk
    FOREIGN KEY (blitz_id) REFERENCES blitzes(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT blitz_assignment_plans_user_fk
    FOREIGN KEY (created_by_id) REFERENCES users(id)
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS blitz_assignment_plans_blitz_id_idx
  ON blitz_assignment_plans(blitz_id);
CREATE INDEX IF NOT EXISTS blitz_assignment_plans_applied_at_idx
  ON blitz_assignment_plans(applied_at);
