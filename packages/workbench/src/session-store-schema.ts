export const CREATE_SESSION_STORE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS commands (
  command_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  expected_revision INTEGER NOT NULL,
  command_json TEXT NOT NULL,
  result_json TEXT,
  committed_revision INTEGER,
  created_at TEXT NOT NULL,
  committed_at TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  kind TEXT NOT NULL,
  event_json TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS events_by_session_revision ON events(session_id, revision, created_at);

CREATE TABLE IF NOT EXISTS stage_attempts (
  attempt_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  command_id TEXT,
  run_reference TEXT,
  manifest_hash TEXT,
  artifact_refs_json TEXT,
  result_json TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS stage_attempts_by_session ON stage_attempts(session_id, started_at);

CREATE TABLE IF NOT EXISTS artifact_refs (
  artifact_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  input_revision INTEGER NOT NULL,
  kind TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  content_hash TEXT,
  manifest_hash TEXT,
  metadata_json TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS scenario_drafts (
  draft_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  draft_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS host_actions (
  action_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  request_json TEXT,
  claim_json TEXT,
  result_json TEXT,
  expires_at TEXT,
  lease_id TEXT,
  lease_expires_at TEXT,
  expected_revision INTEGER,
  confirmation_hash TEXT,
  expected_target_version TEXT,
  updated_at TEXT NOT NULL
) STRICT;
`;