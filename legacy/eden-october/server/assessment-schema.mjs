export const ASSESSMENT_MIGRATIONS=[
 `CREATE TABLE IF NOT EXISTS eden_logic_261001.assessment_sessions (
 learner_id TEXT PRIMARY KEY REFERENCES eden_logic_261001.learners(id) ON DELETE CASCADE,
 started BIGINT NOT NULL, attempt INTEGER NOT NULL DEFAULT 1, final_id TEXT, reopened_reason TEXT NOT NULL DEFAULT '')`,
 `CREATE TABLE IF NOT EXISTS eden_logic_261001.submissions (
 id TEXT PRIMARY KEY, learner_id TEXT NOT NULL REFERENCES eden_logic_261001.learners(id) ON DELETE CASCADE,
 request_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('diagnostic','course')), attempt INTEGER NOT NULL DEFAULT 1,
 created BIGINT NOT NULL, duration_ms BIGINT, digest TEXT NOT NULL, state JSONB NOT NULL,
 grade JSONB, review JSONB, review_version INTEGER NOT NULL DEFAULT 0,
 UNIQUE(learner_id, request_id))`,
 `CREATE INDEX IF NOT EXISTS submissions_learner_created ON eden_logic_261001.submissions(learner_id,created DESC)`,
 `CREATE TABLE IF NOT EXISTS eden_logic_261001.grade_history (
 id BIGSERIAL PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES eden_logic_261001.submissions(id) ON DELETE CASCADE,
 created BIGINT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, payload JSONB NOT NULL)`,
 `INSERT INTO eden_logic_261001.schema_version(version) VALUES (2) ON CONFLICT DO NOTHING`
];
