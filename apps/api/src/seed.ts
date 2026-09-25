import { prisma } from "./prisma.js";
import { addDays } from "./util.js";

async function main() {
  const existing = await prisma.task.count();
  if (!existing) {
    await prisma.task.createMany({
      data: [
        { title: "Join the MineX community", description: "Open the community channel and join.", type: "TELEGRAM_CHANNEL", rewardPoints: 5000n, url: "https://t.me/MineX", telegramChatId: "@MineX", minLevel: 1 },
        { title: "Follow MineX updates", description: "Open the official updates page.", type: "URL_VISIT", rewardPoints: 2500n, url: "https://t.me/MineX", minLevel: 1 },
        { title: "Invite 3 friends", description: "Bring three real users into MineX.", type: "REFERRAL_COUNT", rewardPoints: 10000n, minLevel: 1 }
      ]
    });
  }
  const active = await prisma.airdrop.count({ where: { status: "ACTIVE" } });
  if (!active) {
    await prisma.airdrop.create({
      data: {
        name: "Genesis MineX Airdrop",
        description: "Starter airdrop for active miners.",
        rewardPoints: 25000n,
        minLevel: 3,
        minLifetimePoints: 5000n,
        minReferrals: 1,
        walletRequired: true,
        startsAt: new Date(),
        endsAt: addDays(new Date(), 30),
        status: "ACTIVE"
      }
    });
  }
}
main().then(() => prisma.$disconnect()).catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });