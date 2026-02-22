import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),
  GOOGLE_PLAY_PACKAGE_NAME: z.string().min(1),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().min(1),
  PLUS_YEARLY_PRODUCT_ID: z.string().default("plus_yearly"),
  PRO_YEARLY_PRODUCT_ID: z.string().default("pro_yearly"),
  RTDN_SHARED_SECRET: z.string().min(1)
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const config = parsed.data;
