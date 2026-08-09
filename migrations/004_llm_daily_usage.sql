-- Legacy table (unused). Kept so existing databases keep a clean migration history.
-- Regular users are limited to one generative call/day; admins may refresh.

CREATE TABLE IF NOT EXISTS llm_daily_usage (
    user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    usage_date  date NOT NULL,
    model       text NOT NULL,
    response    jsonb NOT NULL,
    call_count  integer NOT NULL DEFAULT 1,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS llm_daily_usage_date_idx ON llm_daily_usage (usage_date);
