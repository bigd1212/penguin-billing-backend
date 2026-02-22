export type AccessState =
  | "ACTIVE"
  | "GRACE_PERIOD"
  | "ON_HOLD"
  | "PAUSED"
  | "EXPIRED"
  | "REVOKED";

export type MonetizationTier = "FREE" | "PLUS" | "PRO";
export type EntitlementSource = "LOCAL_DEFAULT" | "BACKEND_VERIFIED";

export interface PurchaseRow {
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
}

export interface EntitlementSnapshot {
  tier: MonetizationTier;
  adsEnabled: boolean;
  proToolsEnabled: boolean;
  validUntilEpochMs: number | null;
  source: EntitlementSource;
}
