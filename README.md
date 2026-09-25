# MineX Telegram Mini App + Tap-to-Earn Bot

A production-oriented foundation for a MineX tap/rewards Mini App:
- Telegram Mini App authentication with server-side initData validation
- MineX tap engine with server-side energy, cooldown, multipliers and anti-spam checks
- Levels and XP/points
- Daily reward
- Tasks and task rewards
- Referral tracking
- Airdrop campaigns with eligibility rules
- TON Connect wallet connection
- Withdrawal requests and admin approval flow
- Point ledger and audit log
- PostgreSQL + Prisma
- Admin commands and API hooks
- Mobile-first UI using the supplied MineX logo

## Important security model

The app never asks users for seed phrases or private keys. TON Connect is used to connect a wallet. Automated MineX payouts, if enabled later, must use a dedicated treasury signer stored outside GitHub (for example a deployment secret manager). Start with manual approval until the payout code is audited.

## Quick start

1. Create a bot with @BotFather.
2. Copy the bot token into `.env`.
3. Create a PostgreSQL database (Supabase/Neon/Render PostgreSQL are suitable).
4. Copy `.env.example` to `.env` and fill the values.
5. Run:
   npm install
   npm run db:push
   npm run db:seed
   npm run dev
6. Deploy `apps/web` as a static site and `apps/api` as a Node service, or use a platform that supports the two services.
7. Set `MINI_APP_URL` to the HTTPS web URL.
8. In BotFather, configure the Main Mini App URL and menu button.
9. The public `tonconnect-manifest.json` must be reachable over HTTPS.

## Production checklist

- Use PostgreSQL, not SQLite.
- Set a strong random secret at the reverse proxy if you add session cookies.
- Keep BOT_TOKEN and any treasury signer out of the repository.
- Set CORS_ORIGIN to the exact Mini App origin.
- Put the API behind HTTPS.
- Make the Telegram bot an admin of any channel whose membership is verified by the task engine.
- Audit the payout service before enabling automatic on-chain transfers.
- Add an ad provider only through its official SDK and verify callbacks server-side.
