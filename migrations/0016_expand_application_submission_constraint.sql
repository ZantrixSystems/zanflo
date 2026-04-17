-- Migration: 0016_expand_application_submission_constraint
-- Created: 2026-04-17
-- Scope: Allow submitted_at for the full post-submission lifecycle

ALTER TABLE applications
  DROP CONSTRAINT submitted_at_only_when_submitted;

ALTER TABLE applications
  ADD CONSTRAINT submitted_at_only_when_submitted
  CHECK (
    (
      status IN ('submitted', 'under_review', 'awaiting_information', 'approved', 'refused')
      AND submitted_at IS NOT NULL
    )
    OR
    (
      status = 'draft'
      AND submitted_at IS NULL
    )
  );
