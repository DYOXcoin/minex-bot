CREATE TYPE "TaskType" AS ENUM ('TELEGRAM_CHANNEL','URL_VISIT','REFERRAL_COUNT','DAILY','CUSTOM');
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING','APPROVED','PAID','REJECTED','FAILED');
CREATE TYPE "AirdropStatus" AS ENUM ('DRAFT','ACTIVE','ENDED');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "telegramId" BIGINT NOT NULL UNIQUE,
  "username" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "languageCode" TEXT,
  "points" BIGINT NOT NULL DEFAULT 0,
  "lifetimePoints" BIGINT NOT NULL DEFAULT 0,
  "level" INTEGER NOT NULL DEFAULT 1,
  "energy" INTEGER NOT NULL DEFAULT 1000,
  "maxEnergy" INTEGER NOT NULL DEFAULT 1000,
  "lastEnergyAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastTapAt" TIMESTAMP(3),
  "lastDailyAt" TIMESTAMP(3),
  "streak" INTEGER NOT NULL DEFAULT 0,
  "referredById" TEXT,
  "referralCode" TEXT NOT NULL UNIQUE,
  "walletAddress" TEXT,
  "walletConnectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "TapSession" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "taps" INTEGER NOT NULL DEFAULT 0,
  "points" BIGINT NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastTapAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TapSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE "Task" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "TaskType" NOT NULL,
  "url" TEXT,
  "telegramChatId" TEXT,
  "rewardPoints" BIGINT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "minLevel" INTEGER NOT NULL DEFAULT 1,
  "daily" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "UserTask" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  CONSTRAINT "UserTask_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "UserTask_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE,
  CONSTRAINT "UserTask_userId_taskId_key" UNIQUE ("userId","taskId")
);

CREATE TABLE "Airdrop" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "rewardPoints" BIGINT NOT NULL,
  "minLevel" INTEGER NOT NULL DEFAULT 1,
  "minLifetimePoints" BIGINT NOT NULL DEFAULT 0,
  "minReferrals" INTEGER NOT NULL DEFAULT 0,
  "walletRequired" BOOLEAN NOT NULL DEFAULT FALSE,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "AirdropStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AirdropClaim" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "airdropId" TEXT NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AirdropClaim_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "AirdropClaim_airdropId_fkey"
    FOREIGN KEY ("airdropId") REFERENCES "Airdrop"("id") ON DELETE CASCADE,
  CONSTRAINT "AirdropClaim_userId_airdropId_key" UNIQUE ("userId","airdropId")
);

CREATE TABLE "Withdrawal" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "points" BIGINT NOT NULL,
  "minexAmount" DECIMAL(36,9) NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
  "txHash" TEXT,
  "adminNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Withdrawal_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE "PointLedger" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "amount" BIGINT NOT NULL,
  "balanceAfter" BIGINT NOT NULL,
  "reason" TEXT NOT NULL,
  "refId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointLedger_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE "AdminAction" (
  "id" TEXT PRIMARY KEY,
  "adminId" BIGINT NOT NULL,
  "targetUserId" TEXT,
  "action" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAction_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
);

ALTER TABLE "User"
  ADD CONSTRAINT "User_referredById_fkey"
  FOREIGN KEY ("referredById") REFERENCES "User"("id");

CREATE INDEX "TapSession_userId_startedAt_idx"
  ON "TapSession"("userId","startedAt");

CREATE INDEX "Withdrawal_status_createdAt_idx"
  ON "Withdrawal"("status","createdAt");

CREATE INDEX "PointLedger_userId_createdAt_idx"
  ON "PointLedger"("userId","createdAt");

CREATE INDEX "AdminAction_adminId_createdAt_idx"
  ON "AdminAction"("adminId","createdAt");
