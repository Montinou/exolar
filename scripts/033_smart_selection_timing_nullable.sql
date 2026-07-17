-- =====================================================
-- Migration 033: Nullable timing for decision-only events
-- =====================================================
--
-- PURPOSE:
--   ENG-1434 follow-up: the Eve agent's decision-only events may not have
--   per-turn inference latency / token usage available from its tool
--   context, so `timing` can be omitted entirely from the ingest payload
--   (see app/api/smart-selection-decisions/route.ts, made `.optional()`).
--
--   `timing` is a standalone JSONB column declared NOT NULL in
--   scripts/029_add_smart_selection_decisions.sql. Relax that constraint so
--   decision-only rows without timing data can be stored.
--
-- ROLLBACK:
--   ALTER TABLE smart_selection_decisions ALTER COLUMN timing SET NOT NULL;
--   (Only safe if no NULL rows have been inserted since this migration ran.)
--
-- =====================================================

ALTER TABLE smart_selection_decisions
  ALTER COLUMN timing DROP NOT NULL;
