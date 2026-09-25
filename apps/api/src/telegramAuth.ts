import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { env } from "./config.js";
import { prisma } from "./prisma.js";
import { getLevel } from "./game.js";

function validateInitData(initData: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const pairs = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  const dataCheckString = pairs.join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(env.BOT_TOKEN).digest();
  const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hash))) return null;

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Date.now() / 1000 - authDate > 86400) return null;

  const rawUser = params.get("user");
  if (!rawUser) return null;
  return JSON.parse(rawUser) as {
    id: number; username?: string; first_name?: string; last_name?: string; language_code?: string;
  };
}

export async function auth(req: Request, res: Response, next: NextFunction) {
  try {
    const initData = req.header("x-telegram-init-data");
    if (!initData) return res.status(401).json({ error: "Telegram authentication required" });
    const tg = validateInitData(initData);
    if (!tg) return res.status(401).json({ error: "Invalid or expired Telegram session" });

    const startParam = new URLSearchParams(initData).get("start_param") ?? "";
    let referredById: string | undefined;
    if (startParam.startsWith("ref_")) {
      const code = startParam.slice(4);
      const referrer = await prisma.user.findUnique({ where: { referralCode: code } });
      if (referrer && referrer.telegramId !== BigInt(tg.id)) referredById = referrer.id;
    }

    let user = await prisma.user.findUnique({ where: { telegramId: BigInt(tg.id) } });
    if (!user) {
      const code = `${tg.id}-${crypto.randomBytes(4).toString("hex")}`;
      user = await prisma.user.create({
        data: {
          telegramId: BigInt(tg.id),
          username: tg.username,
          firstName: tg.first_name,
          lastName: tg.last_name,
          languageCode: tg.language_code,
          referralCode: code,
          referredById
        }
      });
      if (referredById) {
        await prisma.$transaction(async tx => {
          await tx.user.update({ where: { id: referredById }, data: { points: { increment: 1000n }, lifetimePoints: { increment: 1000n } } });
          await tx.pointLedger.create({ data: { userId: referredById, amount: 1000n, balanceAfter: 1000n, reason: "REFERRAL_SIGNUP", refId: user!.id } });
        });
      }
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          username: tg.username,
          firstName: tg.first_name,
          lastName: tg.last_name,
          languageCode: tg.language_code
        }
      });
    }
    (req as any).user = user;
    next();
  } catch (e) {
    next(e);
  }
}