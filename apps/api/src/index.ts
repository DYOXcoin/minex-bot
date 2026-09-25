import express from "express";
import cors from "cors";
import helmet from "helmet";
import { z } from "zod";
import { Bot, InlineKeyboard } from "grammy";
import { env, adminIds } from "./config.js";
import { prisma } from "./prisma.js";
import { auth } from "./telegramAuth.js";
import { awardPoints, getLevel, LEVELS, nextLevel, refreshEnergy } from "./game.js";

const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "256kb" }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "minex-api" }));

app.use("/api", auth);

app.get("/api/me", async (req: any, res) => {
  const user = await refreshEnergy(req.user.id);
  const lvl = getLevel(user.lifetimePoints);
  const next = nextLevel(user.lifetimePoints);
  const referrals = await prisma.user.count({ where: { referredById: user.id } });
  res.json({
    id: user.id, telegramId: user.telegramId.toString(), username: user.username,
    firstName: user.firstName, points: user.points.toString(), lifetimePoints: user.lifetimePoints.toString(),
    level: lvl.level, levelName: lvl.name, multiplier: lvl.multiplier,
    energy: user.energy, maxEnergy: user.maxEnergy, streak: user.streak,
    referrals, walletAddress: user.walletAddress,
    nextLevel: next ? { level: next.level, name: next.name, min: next.min.toString() } : null,
    referralLink: `https://t.me/${env.BOT_USERNAME}?startapp=ref_${user.referralCode}`
  });
});

app.get("/api/levels", (_req, res) => res.json(LEVELS.map(l => ({ ...l, min: l.min.toString() }))));

app.post("/api/tap", async (req: any, res) => {
  const schema = z.object({ taps: z.number().int().min(1).max(20) });
  const { taps } = schema.parse(req.body);
  let user = await refreshEnergy(req.user.id);
  if (user.energy < taps) return res.status(400).json({ error: "Not enough energy", energy: user.energy });

  const now = Date.now();
  if (user.lastTapAt && now - user.lastTapAt.getTime() < 80) {
    return res.status(429).json({ error: "Too fast" });
  }

  const lvl = getLevel(user.lifetimePoints);
  const points = BigInt(Math.max(1, Math.floor(taps * lvl.multiplier)));

  user = await prisma.user.update({
    where: { id: user.id },
    data: { energy: { decrement: taps }, lastTapAt: new Date(), lastEnergyAt: new Date() }
  });
  user = await awardPoints(user.id, points, "TAP");
  const updated = await refreshEnergy(user.id);
  res.json({ added: points.toString(), points: updated.points.toString(), lifetimePoints: updated.lifetimePoints.toString(), energy: updated.energy, level: getLevel(updated.lifetimePoints).level });
});

app.post("/api/daily", async (req: any, res) => {
  const now = new Date();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
  if (user.lastDailyAt && now.getTime() - user.lastDailyAt.getTime() < 20 * 60 * 60 * 1000) {
    return res.status(400).json({ error: "Daily reward is not ready yet" });
  }
  const streak = user.streak >= 6 ? 1 : user.streak + 1;
  const reward = 1000n * BigInt(streak);
  await prisma.user.update({ where: { id: user.id }, data: { lastDailyAt: now, streak } });
  const after = await awardPoints(user.id, reward, "DAILY_REWARD");
  res.json({ reward: reward.toString(), streak, points: after.points.toString() });
});

app.get("/api/tasks", async (req: any, res) => {
  const tasks = await prisma.task.findMany({ where: { active: true, minLevel: { lte: req.user.level } }, orderBy: { createdAt: "desc" } });
  const claims = await prisma.userTask.findMany({ where: { userId: req.user.id } });
  const set = new Set(claims.map(c => c.taskId));
  res.json(tasks.map(t => ({ ...t, rewardPoints: t.rewardPoints.toString(), completed: set.has(t.id) })));
});

app.post("/api/tasks/:id/complete", async (req: any, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task || !task.active) return res.status(404).json({ error: "Task not found" });
  if (req.user.level < task.minLevel) return res.status(403).json({ error: "Level requirement not met" });
  const existing = await prisma.userTask.findUnique({ where: { userId_taskId: { userId: req.user.id, taskId: task.id } } });
  if (existing) return res.status(400).json({ error: "Already completed" });

  // Server-side verification for Telegram membership tasks.
  if (task.type === "TELEGRAM_CHANNEL") {
    if (!task.telegramChatId) return res.status(400).json({ error: "Task is missing telegramChatId" });
    try {
      const member = await bot.api.getChatMember(task.telegramChatId, Number(req.user.telegramId));
      const ok = ["creator", "administrator", "member"].includes(member.status);
      if (!ok) return res.status(403).json({ error: "Join the Telegram channel first" });
    } catch {
      return res.status(503).json({ error: "Telegram membership could not be verified. Make the bot an admin of the channel." });
    }
  }

  if (task.type === "REFERRAL_COUNT") {
    const count = await prisma.user.count({ where: { referredById: req.user.id } });
    if (count < 3) return res.status(403).json({ error: "Invite at least 3 users first" });
  }

  // URL/custom/ad tasks should use a provider callback or signed server event in production.
  await prisma.userTask.create({ data: { userId: req.user.id, taskId: task.id } });
  const after = await awardPoints(req.user.id, task.rewardPoints, "TASK", task.id);
  res.json({ reward: task.rewardPoints.toString(), points: after.points.toString() });
});

app.get("/api/airdrops", async (_req, res) => {
  const now = new Date();
  const items = await prisma.airdrop.findMany({ where: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gte: now } }, orderBy: { endsAt: "asc" } });
  res.json(items.map(a => ({ ...a, rewardPoints: a.rewardPoints.toString(), minLifetimePoints: a.minLifetimePoints.toString() })));
});

app.post("/api/airdrops/:id/claim", async (req: any, res) => {
  const a = await prisma.airdrop.findUnique({ where: { id: req.params.id } });
  if (!a) return res.status(404).json({ error: "Airdrop not found" });
  const now = new Date();
  if (a.status !== "ACTIVE" || now < a.startsAt || now > a.endsAt) return res.status(400).json({ error: "Airdrop is not active" });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
  const refs = await prisma.user.count({ where: { referredById: user.id } });
  if (user.level < a.minLevel || user.lifetimePoints < a.minLifetimePoints || refs < a.minReferrals) {
    return res.status(403).json({ error: "Eligibility requirements not met" });
  }
  if (a.walletRequired && !user.walletAddress) return res.status(400).json({ error: "Connect your wallet first" });
  try {
    await prisma.airdropClaim.create({ data: { userId: user.id, airdropId: a.id } });
  } catch {
    return res.status(400).json({ error: "Already claimed" });
  }
  const after = await awardPoints(user.id, a.rewardPoints, "AIRDROP", a.id);
  res.json({ reward: a.rewardPoints.toString(), points: after.points.toString() });
});

app.post("/api/wallet", async (req: any, res) => {
  const { address } = z.object({ address: z.string().min(10).max(128) }).parse(req.body);
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { walletAddress: address, walletConnectedAt: new Date() } });
  res.json({ walletAddress: user.walletAddress });
});

app.post("/api/withdrawals", async (req: any, res) => {
  const { points } = z.object({ points: z.coerce.bigint() }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
  if (!user.walletAddress) return res.status(400).json({ error: "Connect a wallet first" });
  if (points < env.WITHDRAW_MIN_POINTS) return res.status(400).json({ error: `Minimum is ${env.WITHDRAW_MIN_POINTS.toString()} points` });
  if (points > user.points) return res.status(400).json({ error: "Insufficient points" });

  const minexAmount = Number(points) / env.POINTS_PER_MINEX;
  const withdrawal = await prisma.$transaction(async tx => {
    const w = await tx.withdrawal.create({
      data: { userId: user.id, points, minexAmount, walletAddress: user.walletAddress! }
    });
    const updated = await tx.user.update({ where: { id: user.id }, data: { points: { decrement: points } } });
    await tx.pointLedger.create({ data: { userId: user.id, amount: -points, balanceAfter: updated.points, reason: "WITHDRAWAL_LOCK", refId: w.id } });
    return w;
  });
  res.json({ id: withdrawal.id, status: withdrawal.status, minexAmount: withdrawal.minexAmount.toString() });
});

app.get("/api/withdrawals", async (req: any, res) => {
  const rows = await prisma.withdrawal.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" }, take: 20 });
  res.json(rows.map(w => ({ ...w, points: w.points.toString() })));
});

// Admin API
function admin(req: any, res: any, next: any) {
  if (!adminIds.has(req.user.telegramId)) return res.status(403).json({ error: "Admin only" });
  next();
}
app.use("/api/admin", admin);

app.get("/api/admin/stats", async (_req, res) => {
  const [users, pending, totalPoints] = await Promise.all([
    prisma.user.count(),
    prisma.withdrawal.count({ where: { status: "PENDING" } }),
    prisma.user.aggregate({ _sum: { lifetimePoints: true } })
  ]);
  res.json({ users, pendingWithdrawals: pending, lifetimePoints: totalPoints._sum.lifetimePoints?.toString() ?? "0" });
});

app.get("/api/admin/withdrawals", async (_req, res) => {
  const rows = await prisma.withdrawal.findMany({ where: { status: "PENDING" }, include: { user: true }, orderBy: { createdAt: "asc" }, take: 100 });
  res.json(rows.map(w => ({ id: w.id, telegramId: w.user.telegramId.toString(), points: w.points.toString(), minexAmount: w.minexAmount.toString(), walletAddress: w.walletAddress, createdAt: w.createdAt })));
});

app.post("/api/admin/withdrawals/:id", async (req: any, res) => {
  const { action, txHash, note } = z.object({
    action: z.enum(["APPROVED", "PAID", "REJECTED", "FAILED"]),
    txHash: z.string().optional(),
    note: z.string().max(1000).optional()
  }).parse(req.body);

  const w = await prisma.withdrawal.findUnique({ where: { id: req.params.id } });
  if (!w) return res.status(404).json({ error: "Withdrawal not found" });
  if (["REJECTED", "FAILED"].includes(action)) {
    await prisma.$transaction(async tx => {
      await tx.withdrawal.update({ where: { id: w.id }, data: { status: action, adminNote: note } });
      const u = await tx.user.update({ where: { id: w.userId }, data: { points: { increment: w.points } } });
      await tx.pointLedger.create({ data: { userId: w.userId, amount: w.points, balanceAfter: u.points, reason: "WITHDRAWAL_REFUND", refId: w.id } });
      await tx.adminAction.create({ data: { adminId: req.user.telegramId, targetUserId: w.userId, action, payload: { note } } });
    });
  } else {
    await prisma.$transaction(async tx => {
      await tx.withdrawal.update({ where: { id: w.id }, data: { status: action, txHash, adminNote: note } });
      await tx.adminAction.create({ data: { adminId: req.user.telegramId, targetUserId: w.userId, action, payload: { txHash, note } } });
    });
  }
  res.json({ ok: true });
});

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(400).json({ error: err?.message || "Request failed" });
});

const bot = new Bot(env.BOT_TOKEN);
bot.command("start", async ctx => {
  const kb = new InlineKeyboard().webApp("⛏️ Open MineX", env.MINI_APP_URL);
  await ctx.reply(
    "⛏️ MineX is ready.\n\nTap, complete tasks, invite friends and join eligible airdrops. Connect your TON wallet inside the Mini App.",
    { reply_markup: kb }
  );
});
bot.command("app", ctx => ctx.reply("Open MineX:", { reply_markup: new InlineKeyboard().webApp("⛏️ Open MineX", env.MINI_APP_URL) }));
bot.catch(err => console.error("BOT", err));

bot.start().catch(console.error);
app.listen(env.PORT, () => console.log(`MineX API listening on ${env.PORT}`));