CREATE TABLE IF NOT EXISTS play_purchases (
    purchase_token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    package_name TEXT NOT NULL,
    product_id TEXT NOT NULL,
    base_plan_id TEXT,
    access_state TEXT NOT NULL,
    expiry_epoch_ms BIGINT,
    is_trial BOOLEAN NOT NULL DEFAULT FALSE,
    auto_renew_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    raw_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_play_purchases_user_id ON play_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_play_purchases_access_state ON play_purchases(access_state);
