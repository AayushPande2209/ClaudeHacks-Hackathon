-- Repair recommendations schema after the HITL column cleanup.
-- Some environments may have applied 002 when it incorrectly removed status.

ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS status text DEFAULT 'running',
    ADD COLUMN IF NOT EXISTS error text,
    DROP COLUMN IF EXISTS draft_email,
    DROP COLUMN IF EXISTS approved_at;
