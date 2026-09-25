# MineX Admin Rules

Recommended launch configuration:
- Minimum withdrawal: 100,000 points.
- Conversion: 100,000 points = 1 MINEX initially. Change in environment only after community announcement.
- Airdrop: require wallet connection + level 3 + 5,000 lifetime points + 1 referral.
- Daily reward: 1,000 × streak (up to 7-day streak).
- Referral signup: 1,000 points to inviter.
- Tasks: 2,500–10,000 points depending on effort.

Admin responsibilities:
1. Review pending withdrawals.
2. Approve/mark paid only after verifying the transaction.
3. If a withdrawal fails/rejects, use the refund flow; it returns locked points to the user and creates a ledger record.
4. Add real task verification before promoting tasks.
5. For ads, never trust a client-side "ad watched" event. Use the ad provider's server-side callback/webhook.
6. Keep all treasury secrets outside GitHub.
