/** Fixed schema, isolated from any existing Eden Hub tables. No user-supplied SQL. */
import {ASSESSMENT_MIGRATIONS} from "./assessment-schema.mjs";
export const SCHEMA_VERSION=2;
export const MIGRATIONS=[
 `SELECT pg_advisory_xact_lock(726492831)`,
 `CREATE SCHEMA IF NOT EXISTS eden_logic_261001`,
 `CREATE TABLE IF NOT EXISTS eden_logic_261001.learners (
   id TEXT PRIMARY KEY,
   class_id TEXT NOT NULL,
   alias TEXT NOT NULL,
   token_hash TEXT UNIQUE NOT NULL,
   credential_version TEXT NOT NULL,
   expires BIGINT NOT NULL,
   created BIGINT NOT NULL,
   updated BIGINT NOT NULL,
   last_order BIGINT NOT NULL DEFAULT 0,
   summary JSONB,
   core_completed INTEGER NOT NULL DEFAULT 0,
   validation TEXT NOT NULL DEFAULT 'a-valider' CHECK (validation IN ('a-valider','valide','a-revoir')),
   teacher_note TEXT NOT NULL DEFAULT '',
   validated_at BIGINT
 )`,
 `CREATE INDEX IF NOT EXISTS learners_class_updated ON eden_logic_261001.learners(class_id,updated DESC)`,
 `CREATE TABLE IF NOT EXISTS eden_logic_261001.events (
   learner_id TEXT NOT NULL REFERENCES eden_logic_261001.learners(id) ON DELETE CASCADE,
   event_id TEXT NOT NULL,
   received BIGINT NOT NULL,
   event JSONB NOT NULL,
   PRIMARY KEY(learner_id,event_id)
 )`,
 `CREATE INDEX IF NOT EXISTS events_learner_received ON eden_logic_261001.events(learner_id,received DESC)`,
 `CREATE TABLE IF NOT EXISTS eden_logic_261001.teacher_sessions (
   token_hash TEXT PRIMARY KEY,
   class_id TEXT NOT NULL,
   credential_version TEXT NOT NULL,
   expires BIGINT NOT NULL
 )`,
 `CREATE INDEX IF NOT EXISTS teacher_sessions_expires ON eden_logic_261001.teacher_sessions(expires)`,
 `CREATE TABLE IF NOT EXISTS eden_logic_261001.rate_limits (
   bucket TEXT PRIMARY KEY,
   expires BIGINT NOT NULL,
   n INTEGER NOT NULL
 )`,
 `CREATE INDEX IF NOT EXISTS rate_limits_expires ON eden_logic_261001.rate_limits(expires)`,
 `CREATE TABLE IF NOT EXISTS eden_logic_261001.schema_version (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
 `INSERT INTO eden_logic_261001.schema_version(version) VALUES (1) ON CONFLICT DO NOTHING`
, ...ASSESSMENT_MIGRATIONS
];
