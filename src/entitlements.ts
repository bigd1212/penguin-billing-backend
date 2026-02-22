import { config } from "./config.js";
import type { EntitlementSnapshot, MonetizationTier, PurchaseRow } from "./types.js";

const ACTIVE_STATES = new Set(["ACTIVE", "GRACE_PERIOD"]);

export function resolveEntitlements(input: {
  purchases: PurchaseRow[];
  nowEpochMs?: number;
}): EntitlementSnapshot {
  const now = input.nowEpochMs ?? Date.now();
  const active = input.purchases.filter(
    (purchase) =>
      ACTIVE_STATES.has(purchase.accessState) &&
      (purchase.expiryEpochMs === null || purchase.expiryEpochMs > now)
  );

  if (active.length === 0) {
    return {
      tier: "FREE",
      adsEnabled: true,
      proToolsEnabled: false,
      validUntilEpochMs: null,
      source: "LOCAL_DEFAULT"
    };
  }

  const tier = active
    .map((purchase) => productToTier(purchase.productId))
    .reduce((acc, t) => (rank(t) > rank(acc) ? t : acc), "FREE" as MonetizationTier);

  const validUntilEpochMs = active
    .filter((purchase) => productToTier(purchase.productId) === tier)
    .map((purchase) => purchase.expiryEpochMs)
    .filter((value): value is number => value !== null)
    .sort((a, b) => b - a)[0] ?? null;

  return {
    tier,
    adsEnabled: tier === "FREE",
    proToolsEnabled: tier === "PRO",
    validUntilEpochMs,
    source: "BACKEND_VERIFIED"
  };
}

function productToTier(productId: string): MonetizationTier {
  if (productId === config.PRO_YEARLY_PRODUCT_ID) return "PRO";
  if (productId === config.PLUS_YEARLY_PRODUCT_ID) return "PLUS";
  return "FREE";
}

function rank(tier: MonetizationTier): number {
  switch (tier) {
    case "FREE":
      return 0;
    case "PLUS":
      return 1;
    case "PRO":
      return 2;
  }
}
