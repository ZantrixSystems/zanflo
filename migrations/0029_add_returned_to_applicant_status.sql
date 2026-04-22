-- Migration 0029: Add returned_to_applicant to premise_licence_cases status constraint
--
-- The returned_to_applicant status allows officers to send a case back to the
-- applicant for correction before progressing it further.

ALTER TABLE premise_licence_cases
  DROP CONSTRAINT plc_status_values;

ALTER TABLE premise_licence_cases
  ADD CONSTRAINT plc_status_values CHECK (status IN (
    'draft',
    'submitted',
    'under_review',
    'returned_to_applicant',
    'awaiting_information',
    'waiting_on_officer',
    'verified',
    'under_consultation',
    'licensed',
    'refused'
  ));
