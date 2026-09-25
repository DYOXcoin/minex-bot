import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  BOT_TOKEN: z.string().min(10),
  BOT_USERNAME: z.string().default("MineXBot"),
  MINI_APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  ADMIN_IDS: z.string().default(""),
  PORT: z.coerce.number().default(8080),
  CORS_ORIGIN: z.string().url(),
  POINTS_PER_MINEX: z.coerce.number().positive().default(100000),
  WITHDRAW_MIN_POINTS: z.coerce.bigint().positive().default(100000n),
  MINEX_JETTON_MASTER: z.string().optional(),
  TREASURY_ADDRESS: z.string().optional(),
  TREASURY_MNEMONIC: z.string().optional(),
  TONCONNECT_MANIFEST_URL: z.string().url()
});

export const env = schema.parse(process.env);
export const adminIds = new Set(
  env.ADMIN_IDS.split(",").map(v => v.trim()).filter(Boolean).map(v => BigInt(v))
);