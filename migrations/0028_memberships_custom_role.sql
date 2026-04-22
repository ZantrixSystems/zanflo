-- Allow a membership to reference a custom role in addition to the built-in role.
-- When custom_role_id is set, permission enforcement uses the custom role's
-- permission set rather than the built-in role defaults.
ALTER TABLE memberships
  ADD COLUMN custom_role_id UUID REFERENCES custom_roles(id) ON DELETE SET NULL;

CREATE INDEX idx_memberships_custom_role ON memberships(custom_role_id)
  WHERE custom_role_id IS NOT NULL;
