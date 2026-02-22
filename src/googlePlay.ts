import { google, androidpublisher_v3 } from "googleapis";
import { config } from "./config.js";
import type { AccessState } from "./types.js";

export interface VerifiedSubscription {
  accessState: AccessState;
  productId: string;
  basePlanId: string | null;
  expiryEpochMs: number | null;
  isTrial: boolean;
  autoRenewEnabled: boolean;
  acknowledged: boolean;
  rawPayload: unknown;
}

let publisherClientPromise: Promise<androidpublisher_v3.Androidpublisher> | null = null;

async function getPublisherClient(): Promise<androidpublisher_v3.Androidpublisher> {
  if (!publisherClientPromise) {
    publisherClientPromise = (async () => {
      const credentials = JSON.parse(config.GOOGLE_SERVICE_ACCOUNT_JSON);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/androidpublisher"]
      });
      return google.androidpublisher({ version: "v3", auth });
    })();
  }
  return publisherClientPromise;
}

export async function verifySubscriptionByToken(input: {
  packageName: string;
  purchaseToken: string;
  expectedProductId?: string;
}): Promise<VerifiedSubscription> {
  const publisher = await getPublisherClient();
  const response = await publisher.purchases.subscriptionsv2.get({
    packageName: input.packageName,
    token: input.purchaseToken
  });

  const data = response.data;
  const lineItems = data.lineItems ?? [];
  if (lineItems.length === 0) {
    throw new Error("No line items in subscription response");
  }

  const matching =
    lineItems.find((item) => item.productId === input.expectedProductId) ?? lineItems[0];

  const expiryEpochMs = matching.expiryTime
    ? Date.parse(matching.expiryTime)
    : null;
  const state = mapSubscriptionState(data.subscriptionState);

  return {
    accessState: state,
    productId: matching.productId ?? input.expectedProductId ?? "unknown_product",
    basePlanId: matching.offerDetails?.basePlanId ?? null,
    expiryEpochMs: Number.isFinite(expiryEpochMs) ? expiryEpochMs : null,
    isTrial: false,
    autoRenewEnabled: Boolean(matching.autoRenewingPlan),
    acknowledged: data.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    rawPayload: data
  };
}

function mapSubscriptionState(
  value: androidpublisher_v3.Schema$SubscriptionPurchaseV2["subscriptionState"]
): AccessState {
  switch (value) {
    case "SUBSCRIPTION_STATE_ACTIVE":
      return "ACTIVE";
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      return "GRACE_PERIOD";
    case "SUBSCRIPTION_STATE_ON_HOLD":
      return "ON_HOLD";
    case "SUBSCRIPTION_STATE_PAUSED":
      return "PAUSED";
    case "SUBSCRIPTION_STATE_EXPIRED":
      return "EXPIRED";
    case "SUBSCRIPTION_STATE_CANCELED":
      return "EXPIRED";
    default:
      return "REVOKED";
  }
}
