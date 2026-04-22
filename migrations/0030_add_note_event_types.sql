-- Migration 0030: Add note_internal and note_public to case_events event_type constraint
--
-- Replaces officer_note with two explicit visibility-aware types.
-- officer_note is retained for backwards compatibility with existing data.

ALTER TABLE case_events
  DROP CONSTRAINT ce_event_type_values;

ALTER TABLE case_events
  ADD CONSTRAINT ce_event_type_values CHECK (event_type IN (
    'case_created',
    'case_submitted',
    'case_modified',
    'status_changed',
    'officer_assigned',
    'information_requested',
    'information_provided',
    'section_added',
    'officer_note',
    'note_internal',
    'note_public',
    'applicant_message',
    'decision_made'
  ));
