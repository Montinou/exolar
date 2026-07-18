-- =====================================================
-- Migration 035: Include `model` in the smart_selection_decisions unique key
-- =====================================================
--
-- PURPOSE:
--   ENG-1434: the Eve agent and the legacy "classic" engine both log
--   decisions for the same PR under mode='shadow' with the SAME head_sha
--   (the real PR head commit). The original unique/upsert key
--   (organization_id, repository, pr_number, head_sha, mode) does NOT
--   include `model`, so the two engines' rows collide and overwrite each
--   other (classic runs post-test, later, so it clobbered Eve's row).
--
--   Adding `model` to the unique key lets both engines coexist cleanly,
--   distinguishable by model (e.g. 'claude-sonnet-5' vs
--   'google/gemini-3.1-flash-lite') — useful for shadow-mode comparison —
--   with no clobbering. Matches the ON CONFLICT target in
--   lib/db/smart-selection.ts.
--
--   Safe on existing data: rows were unique under the old (narrower) key,
--   so they remain unique under this superset key — no violation possible.
--
-- ROLLBACK:
--   ALTER TABLE smart_selection_decisions
--     DROP CONSTRAINT smart_selection_decisions_unique_per_push;
--   ALTER TABLE smart_selection_decisions
--     ADD CONSTRAINT smart_selection_decisions_unique_per_push
--     UNIQUE (organization_id, repository, pr_number, head_sha, mode);
--   (Only safe if no two rows differ only by `model` for the same key.)
--
-- =====================================================

ALTER TABLE smart_selection_decisions
  DROP CONSTRAINT smart_selection_decisions_unique_per_push;

ALTER TABLE smart_selection_decisions
  ADD CONSTRAINT smart_selection_decisions_unique_per_push
  UNIQUE (organization_id, repository, pr_number, head_sha, mode, model);
