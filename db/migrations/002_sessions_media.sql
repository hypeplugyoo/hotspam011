CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,user_id) REFERENCES memberships(organization_id,user_id) ON DELETE CASCADE
);
CREATE INDEX user_sessions_active_idx ON user_sessions(token_hash,expires_at) WHERE revoked_at IS NULL;
ALTER TABLE media ADD COLUMN original_name text NOT NULL DEFAULT 'uploaded-media';
ALTER TABLE media ADD COLUMN status text NOT NULL DEFAULT 'UPLOADING';
