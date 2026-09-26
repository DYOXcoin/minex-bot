import React from "react";
import { createRoot } from "react-dom/client";
import { TonConnectUI } from "@tonconnect/ui";
import "./styles.css";

declare global {
  interface Window { Telegram?: any }
}

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const API = import.meta.env.VITE_API_URL || "http://localhost:8080";
let walletUi: TonConnectUI | null = null;

function initWallet() {
  walletUi = new TonConnectUI({
    manifestUrl: import.meta.env.VITE_TONCONNECT_MANIFEST_URL || `${location.origin}/tonconnect-manifest.json`,
    
  });
  return walletUi;
}

async function api(path: string, options: RequestInit = {}) {
  const initData = tg?.initData || "";
  const r = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", "x-telegram-init-data": initData, ...(options.headers || {}) }
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}

type Me = {
  points: string; lifetimePoints: string; level: number; levelName: string; multiplier: number;
  energy: number; maxEnergy: number; streak: number; referrals: number; walletAddress?: string;
  nextLevel?: { level:number; name:string; min:string } | null; referralLink:string;
};

function App() {
  const [me, setMe] = React.useState<Me | null>(null);
  const [tab, setTab] = React.useState("mine");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [tasks, setTasks] = React.useState<any[]>([]);
  const [airdrops, setAirdrops] = React.useState<any[]>([]);

  const load = React.useCallback(async () => {
    const data = await api("/api/me");
    setMe(data);
  }, []);

  React.useEffect(() => {
    initWallet();
    load().catch(e => setMessage(e.message));
  }, [load]);

  React.useEffect(() => {
    if (tab === "tasks") api("/api/tasks").then(setTasks).catch(e => setMessage(e.message));
    if (tab === "airdrop") api("/api/airdrops").then(setAirdrops).catch(e => setMessage(e.message));
  }, [tab]);

  const tap = async () => {
    if (busy || !me || me.energy <= 0) return;
    setBusy(true);
    try {
      const d = await api("/api/tap", { method:"POST", body:JSON.stringify({ taps:1 }) });
      setMe(x => x ? { ...x, points:d.points, lifetimePoints:d.lifetimePoints, energy:d.energy, level:d.level } : x);
    } catch(e:any) { setMessage(e.message); }
    finally { setBusy(false); }
  };

  const daily = async () => {
    try { const d = await api("/api/daily",{method:"POST"}); setMessage(`+${d.reward} points • Day ${d.streak}`); await load(); }
    catch(e:any){setMessage(e.message);}
  };

  const connectWallet = async () => {
    try {
      if (!walletUi) initWallet();
      await walletUi!.openModal();
      const w = walletUi!.wallet;
      if (w?.account?.address) {
        await api("/api/wallet",{method:"POST",body:JSON.stringify({address:w.account.address})});
        await load();
        setMessage("Wallet connected");
      }
    } catch(e:any){setMessage(e.message);}
  };

  const claimTask = async (id:string) => {
    try { const d=await api(`/api/tasks/${id}/complete`,{method:"POST"}); setMessage(`+${d.reward} points`); await load(); setTasks(await api("/api/tasks")); }
    catch(e:any){setMessage(e.message);}
  };

  const claimAirdrop = async (id:string) => {
    try { const d=await api(`/api/airdrops/${id}/claim`,{method:"POST"}); setMessage(`Airdrop +${d.reward} points`); await load(); }
    catch(e:any){setMessage(e.message);}
  };

  if (!me) return <div className="loading">Loading MineX…</div>;

  return <div className="app">
    <header>
      <div className="brand"><img src="/minex-logo.png"/><div><b>MineX</b><span>Tap • Earn • Connect</span></div></div>
      <button className="wallet" onClick={connectWallet}>{me.walletAddress ? "✓ Wallet" : "Connect"}</button>
    </header>

    <section className="hero">
      <div className="level">{me.levelName} · LVL {me.level}</div>
      <div className="points">{Number(me.points).toLocaleString()} <small>MINEX Points</small></div>
      <div className="bar"><i style={{width:`${Math.min(100, me.energy/me.maxEnergy*100)}%`}}/></div>
      <div className="energy">⚡ {me.energy}/{me.maxEnergy} · ×{me.multiplier} multiplier</div>
    </section>

    {tab === "mine" && <main className="mine">
      <button className="coin" onClick={tap} disabled={busy || me.energy<=0}><img src="/minex-logo.png"/><span>MINEX</span></button>
      <button className="daily" onClick={daily}>🎁 Daily Reward</button>
      {message && <div className="toast">{message}</div>}
      <div className="cards">
        <div><b>{me.level}</b><span>Level</span></div>
        <div><b>{me.referrals}</b><span>Referrals</span></div>
        <div><b>{me.streak}</b><span>Daily streak</span></div>
      </div>
      {me.nextLevel && <div className="next">Next: <b>{me.nextLevel.name}</b> at {Number(me.nextLevel.min).toLocaleString()} lifetime points</div>}
    </main>}

    {tab === "tasks" && <main className="list">
      <h2>Tasks</h2>
      {tasks.map(t=><div className="item" key={t.id}><div><b>{t.title}</b><p>{t.description}</p><strong>+{Number(t.rewardPoints).toLocaleString()}</strong></div><button disabled={t.completed} onClick={()=>claimTask(t.id)}>{t.completed?"Done":"Claim"}</button></div>)}
    </main>}

    {tab === "airdrop" && <main className="list">
      <h2>Airdrops</h2>
      {airdrops.map(a=><div className="item" key={a.id}><div><b>{a.name}</b><p>{a.description}</p><strong>+{Number(a.rewardPoints).toLocaleString()}</strong></div><button onClick={()=>claimAirdrop(a.id)}>Claim</button></div>)}
    </main>}

    {tab === "wallet" && <main className="walletPage">
      <h2>Wallet</h2>
      <div id="ton-connect"></div>
      <p>{me.walletAddress || "No wallet connected."}</p>
      <small>Never enter a seed phrase here. Connection is handled by TON Connect.</small>
    </main>}

    <nav>
      <button className={tab==="mine"?"active":""} onClick={()=>setTab("mine")}>⛏️<span>Mine</span></button>
      <button className={tab==="tasks"?"active":""} onClick={()=>setTab("tasks")}>✓<span>Tasks</span></button>
      <button className={tab==="airdrop"?"active":""} onClick={()=>setTab("airdrop")}>🎁<span>Airdrop</span></button>
      <button className={tab==="wallet"?"active":""} onClick={()=>setTab("wallet")}>◉<span>Wallet</span></button>
    </nav>
  </div>
}

createRoot(document.getElementById("root")!).render(<App />);