-- Remove obsolete HITL Gate columns from recommendations table.
-- Keep status/error because the pipeline and UI use them for lifecycle tracking.

ALTER TABLE recommendations
    DROP COLUMN IF EXISTS draft_email,
    DROP COLUMN IF EXISTS approved_at;
