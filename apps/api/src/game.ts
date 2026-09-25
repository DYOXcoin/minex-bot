import { prisma } from "./prisma.js";

export const LEVELS = [
  { level: 1, name: "Rookie", min: 0n, multiplier: 1 },
  { level: 2, name: "Miner", min: 1_000n, multiplier: 1 },
  { level: 3, name: "Explorer", min: 5_000n, multiplier: 1.1 },
  { level: 4, name: "Operator", min: 15_000n, multiplier: 1.2 },
  { level: 5, name: "Builder", min: 50_000n, multiplier: 1.35 },
  { level: 6, name: "Pioneer", min: 150_000n, multiplier: 1.5 },
  { level: 7, name: "Vanguard", min: 500_000n, multiplier: 1.75 },
  { level: 8, name: "Elite", min: 1_500_000n, multiplier: 2 },
  { level: 9, name: "Master", min: 5_000_000n, multiplier: 2.5 },
  { level: 10, name: "Legend", min: 15_000_000n, multiplier: 3 }
] as const;

export function getLevel(lifetimePoints: bigint) {
  let current: (typeof LEVELS)[number] = LEVELS[0];
  for (const level of LEVELS) {
    if (lifetimePoints >= level.min) current = level;
  }
  return current;
}

export function nextLevel(lifetimePoints: bigint) {
  return LEVELS.find(l => l.min > lifetimePoints) ?? null;
}

export async function refreshEnergy(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const now = Date.now();
  const elapsed = Math.floor((now - user.lastEnergyAt.getTime()) / 2000);
  if (elapsed <= 0) return user;
  const energy = Math.min(user.maxEnergy, user.energy + elapsed);
  return prisma.user.update({
    where: { id: userId },
    data: { energy, lastEnergyAt: new Date(user.lastEnergyAt.getTime() + elapsed * 2000) }
  });
}

export async function awardPoints(
  userId: string,
  amount: bigint,
  reason: string,
  refId?: string
) {
  if (amount <= 0n) throw new Error("amount must be positive");
  return prisma.$transaction(async tx => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        points: { increment: amount },
        lifetimePoints: { increment: amount }
      }
    });
    const level = getLevel(user.lifetimePoints);
    if (level.level !== user.level) {
      await tx.user.update({ where: { id: userId }, data: { level: level.level } });
    }
    await tx.pointLedger.create({
      data: { userId, amount, balanceAfter: user.points, reason, refId }
    });
    return user;
  });
}