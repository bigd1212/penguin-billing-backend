import { Pool } from "pg";
import { config } from "./config.js";
import type { AccessState, PurchaseRow } from "./types.js";

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.DATABASE_URL.includes("railway") ? { rejectUnauthorized: false } : undefined
});

export async function ensureSchema(): Promise<void> {
  await pool.query(`
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
  `);
}

export async function upsertPurchase(input: {
  purchaseToken: string;
  userId: string;
  packageName: string;
  productId: string;
  basePlanId: string | null;
  accessState: AccessState;
  expiryEpochMs: number | null;
  isTrial: boolean;
  autoRenewEnabled: boolean;
  acknowledged: boolean;
  rawPayload: unknown;
}): Promise<void> {
  await pool.query(
    `
    INSERT INTO play_purchases (
      purchase_token, user_id, package_name, product_id, base_plan_id,
      access_state, expiry_epoch_ms, is_trial, auto_renew_enabled,
      acknowledged, raw_payload, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
    ON CONFLICT (purchase_token) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      package_name = EXCLUDED.package_name,
      product_id = EXCLUDED.product_id,
      base_plan_id = EXCLUDED.base_plan_id,
      access_state = EXCLUDED.access_state,
      expiry_epoch_ms = EXCLUDED.expiry_epoch_ms,
      is_trial = EXCLUDED.is_trial,
      auto_renew_enabled = EXCLUDED.auto_renew_enabled,
      acknowledged = EXCLUDED.acknowledged,
      raw_payload = EXCLUDED.raw_payload,
      updated_at = NOW()
    `,
    [
      input.purchaseToken,
      input.userId,
      input.packageName,
      input.productId,
      input.basePlanId,
      input.accessState,
      input.expiryEpochMs,
      input.isTrial,
      input.autoRenewEnabled,
      input.acknowledged,
      JSON.stringify(input.rawPayload)
    ]
  );
}

export async function getPurchaseByToken(purchaseToken: string): Promise<PurchaseRow | null> {
  const res = await pool.query(
    `
    SELECT purchase_token, user_id, package_name, product_id, base_plan_id, access_state,
           expiry_epoch_ms, is_trial, auto_renew_enabled, acknowledged
    FROM play_purchases
    WHERE purchase_token = $1
    `,
    [purchaseToken]
  );
  if (res.rowCount === 0) return null;
  return toRow(res.rows[0]);
}

export async function listPurchasesForUser(userId: string): Promise<PurchaseRow[]> {
  const res = await pool.query(
    `
    SELECT purchase_token, user_id, package_name, product_id, base_plan_id, access_state,
           expiry_epoch_ms, is_trial, auto_renew_enabled, acknowledged
    FROM play_purchases
    WHERE user_id = $1
    ORDER BY updated_at DESC
    `,
    [userId]
  );
  return res.rows.map(toRow);
}

function toRow(row: Record<string, unknown>): PurchaseRow {
  return {
    purchaseToken: String(row.purchase_token),
    userId: String(row.user_id),
    packageName: String(row.package_name),
    productId: String(row.product_id),
    basePlanId: row.base_plan_id ? String(row.base_plan_id) : null,
    accessState: String(row.access_state) as AccessState,
    expiryEpochMs: row.expiry_epoch_ms === null ? null : Number(row.expiry_epoch_ms),
    isTrial: Boolean(row.is_trial),
    autoRenewEnabled: Boolean(row.auto_renew_enabled),
    acknowledged: Boolean(row.acknowledged)
  };
}
