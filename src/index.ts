import express from "express";
import pino from "pino";
import { z } from "zod";
import { config } from "./config.js";
import { ensureSchema, getPurchaseByToken, listPurchasesForUser, upsertPurchase } from "./db.js";
import { resolveEntitlements } from "./entitlements.js";
import { verifySubscriptionByToken } from "./googlePlay.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });
const app = express();

app.use(express.json({ limit: "1mb" }));
app.use((req, _res, next) => {
  logger.info({ method: req.method, path: req.path }, "request");
  next();
});

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, service: "penguin-billing-backend" });
});

const verifyPurchaseSchema = z.object({
  userId: z.string().min(1),
  packageName: z.string().min(1),
  productId: z.string().min(1),
  purchaseToken: z.string().min(1)
});

app.post("/v1/purchases/verify", async (req, res) => {
  const parsed = verifyPurchaseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
    return;
  }

  const body = parsed.data;

  try {
    const verified = await verifySubscriptionByToken({
      packageName: body.packageName,
      purchaseToken: body.purchaseToken,
      expectedProductId: body.productId
    });

    await upsertPurchase({
      purchaseToken: body.purchaseToken,
      userId: body.userId,
      packageName: body.packageName,
      productId: verified.productId,
      basePlanId: verified.basePlanId,
      accessState: verified.accessState,
      expiryEpochMs: verified.expiryEpochMs,
      isTrial: verified.isTrial,
      autoRenewEnabled: verified.autoRenewEnabled,
      acknowledged: verified.acknowledged,
      rawPayload: verified.rawPayload
    });

    const purchases = await listPurchasesForUser(body.userId);
    const entitlements = resolveEntitlements({ purchases });

    res.status(200).json({
      purchase: {
        productId: verified.productId,
        purchaseToken: body.purchaseToken,
        basePlanId: verified.basePlanId,
        acknowledged: verified.acknowledged,
        autoRenewEnabled: verified.autoRenewEnabled
      },
      entitlements,
      serverTimeEpochMs: Date.now()
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to verify purchase token");
    res.status(502).json({ error: "verification_failed" });
  }
});

app.get("/v1/entitlements", async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : "";
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const purchases = await listPurchasesForUser(userId);
  const entitlements = resolveEntitlements({ purchases });

  res.status(200).json({
    entitlements,
    activeSubscriptions: purchases.map((purchase) => ({
      productId: purchase.productId,
      basePlanId: purchase.basePlanId,
      accessState: purchase.accessState,
      expiryEpochMs: purchase.expiryEpochMs,
      isTrial: purchase.isTrial,
      autoRenewEnabled: purchase.autoRenewEnabled
    })),
    serverTimeEpochMs: Date.now()
  });
});

const rtdnSchema = z.object({
  message: z.object({
    data: z.string(),
    messageId: z.string().optional()
  }),
  subscription: z.string().optional()
});

app.post("/v1/rtdn/google-play", async (req, res) => {
  const sharedSecret = req.header("x-rtdn-secret");
  if (sharedSecret !== config.RTDN_SHARED_SECRET) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const parsed = rtdnSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_rtdn_payload" });
    return;
  }

  try {
    const dataRaw = Buffer.from(parsed.data.message.data, "base64").toString("utf8");
    const payload = JSON.parse(dataRaw) as {
      packageName?: string;
      subscriptionNotification?: {
        purchaseToken?: string;
        subscriptionId?: string;
      };
    };

    const purchaseToken = payload.subscriptionNotification?.purchaseToken;
    if (!purchaseToken) {
      res.status(202).json({ ok: true, ignored: "missing_purchase_token" });
      return;
    }

    const existing = await getPurchaseByToken(purchaseToken);
    if (!existing) {
      logger.warn({ purchaseToken }, "RTDN token not linked to a user yet; skipping upsert");
      res.status(202).json({ ok: true, ignored: "unknown_purchase_token" });
      return;
    }

    const verified = await verifySubscriptionByToken({
      packageName: existing.packageName,
      purchaseToken,
      expectedProductId: existing.productId
    });

    await upsertPurchase({
      purchaseToken,
      userId: existing.userId,
      packageName: existing.packageName,
      productId: verified.productId,
      basePlanId: verified.basePlanId,
      accessState: verified.accessState,
      expiryEpochMs: verified.expiryEpochMs,
      isTrial: verified.isTrial,
      autoRenewEnabled: verified.autoRenewEnabled,
      acknowledged: verified.acknowledged,
      rawPayload: verified.rawPayload
    });

    res.status(202).json({ ok: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to process RTDN");
    res.status(500).json({ error: "rtdn_processing_failed" });
  }
});

async function bootstrap(): Promise<void> {
  await ensureSchema();
  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "penguin-billing-backend started");
  });
}

bootstrap().catch((error) => {
  logger.error({ err: error }, "Startup failure");
  process.exit(1);
});
