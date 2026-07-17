-- =====================================================
-- Migration 032: Nullable confidence/metrics/actual_run for decision-only events
-- =====================================================
--
-- PURPOSE:
--   ENG-1434 adds a new smart-selection client (the "Eve" agent) that sends
--   only its DECISION (selected/skipped suites) with NO confidence score and
--   NO metrics yet — confidence/metrics/actual_run get computed later by a
--   separate query-time join task, not this one.
--
--   `confidence` lives inside the `output` JSONB column (not a standalone
--   column), so there is no column-level NOT NULL constraint to relax for
--   it — JSONB accepts a `null` value for that key today. Nullability there
--   is enforced only at the application layer (zod schema in
--   app/api/smart-selection-decisions/route.ts).
--
--   `actual_run` and `metrics`, however, ARE standalone JSONB columns
--   declared NOT NULL in scripts/029_add_smart_selection_decisions.sql.
--   Decision-only rows omit both entirely, so we relax those constraints
--   here to allow NULL.
--
-- ROLLBACK:
--   ALTER TABLE smart_selection_decisions ALTER COLUMN actual_run SET NOT NULL;
--   ALTER TABLE smart_selection_decisions ALTER COLUMN metrics SET NOT NULL;
--   (Only safe if no NULL rows have been inserted since this migration ran.)
--
-- =====================================================

ALTER TABLE smart_selection_decisions
  ALTER COLUMN actual_run DROP NOT NULL;

ALTER TABLE smart_selection_decisions
  ALTER COLUMN metrics DROP NOT NULL;
