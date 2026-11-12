"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { cyr } from "@/lib/cyr";

type Stats = {
  users: { total: number; started: number; new1: number; new7: number; act1: number; act7: number; act30: number };
  spots: { total: number; complete: number; incomplete: number; last7: number; owners: number };
  comments: { total: number; last7: number };
  media: { photos: number; videos: number };
  byRegion: { k: string; n: number }[];
  byFish: { k: string; n: number }[];
  top: { name: string; username: string; spots: number; comments: number }[];
  recent: { name: string; username: string; first_seen: string; last_seen: string; opens: number }[];
  daily: { day: string; active: number; fresh: number; spots: number }[];
};

const fmt = (s: string) =>
  new Date(s).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Card({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
      <div style={{ fontSize: 13, color: "#58706f" }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: "#14575f" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#58706f" }}>{sub}</div>}
    </div>
  );
}

function Bars({ rows, color }: { rows: { k: string; n: number }[]; color: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {rows.map((r) => (
        <div key={r.k} style={{ display: "grid", gridTemplateColumns: "120px 1fr 36px", gap: 8, alignItems: "center", fontSize: 14 }}>
          <span>{cyr(r.k)}</span>
          <div style={{ background: "#e3eceb", borderRadius: 99, height: 12 }}>
            <div style={{ width: `${(r.n / max) * 100}%`, background: color, height: 12, borderRadius: 99 }} />
          </div>
          <b>{r.n}</b>
        </div>
      ))}
    </div>
  );
}

function Daily({ rows }: { rows: Stats["daily"] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.active, r.fresh, r.spots)));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
        {rows.map((r) => (
          <div key={r.day} style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 1, height: "100%" }}>
            {[[r.active, "#14575f"], [r.fresh, "#e8803a"], [r.spots, "#5aa845"]].map(([v, c], i) => (
              <div key={i} style={{ flex: 1, height: `${(Number(v) / max) * 100}%`, minHeight: Number(v) ? 3 : 0, background: String(c), borderRadius: 2 }} />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 4, fontSize: 9, color: "#58706f", marginTop: 4 }}>
        {rows.map((r) => <span key={r.day} style={{ flex: 1, textAlign: "center" }}>{r.day.slice(0, 2)}</span>)}
      </div>
      <div style={{ fontSize: 12, marginTop: 8, display: "flex", gap: 14 }}>
        <span><i style={{ background: "#14575f" }} className="lg" /> Фаол</span>
        <span><i style={{ background: "#e8803a" }} className="lg" /> Янги</span>
        <span><i style={{ background: "#5aa845" }} className="lg" /> Жой</span>
      </div>
      <style>{`.lg{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px}`}</style>
    </div>
  );
}

export default function Admin() {
  const [s, setS] = useState<Stats | null>(null);
  const [state, setState] = useState<"load" | "ok" | "no">("load");

  const load = () =>
    api<Stats>("/api/admin/stats")
      .then((d) => { setS(d); setState("ok"); })
      .catch(() => setState("no"));

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    load();
  }, []);

  if (state === "load") return <div style={{ padding: 24 }}>Юкланмоқда…</div>;
  if (state === "no" || !s) return <div style={{ padding: 24, color: "#58706f" }}>Топилмади</div>;

  const box = { background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.08)", marginTop: 14 } as const;
  const h = { fontSize: 16, fontWeight: 800, margin: "0 0 10px" } as const;
  return (
    <div style={{ background: "#eef3f1", minHeight: "100vh", padding: 16, color: "#16282b", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>📊 Статистика</h1>
        <button onClick={load} style={{ border: 0, background: "#14575f", color: "#fff", borderRadius: 12, padding: "8px 14px", fontWeight: 700 }}>↻ Янгилаш</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
        <Card label="Жами фойдаланувчи" value={s.users.total} sub={`Start босган: ${s.users.started}`} />
        <Card label="Бугун фаол" value={s.users.act1} sub={`7 кунда: ${s.users.act7} · 30 кунда: ${s.users.act30}`} />
        <Card label="Янги (бугун)" value={s.users.new1} sub={`7 кунда: ${s.users.new7}`} />
        <Card label="Жами жой" value={s.spots.total} sub={`7 кунда: +${s.spots.last7}`} />
        <Card label="Тўлиқ жойлар" value={s.spots.complete} />
        <Card label="Тўлиқ эмас" value={s.spots.incomplete} />
        <Card label="Жой қўшганлар" value={s.spots.owners} />
        <Card label="Коммент" value={s.comments.total} sub={`7 кунда: +${s.comments.last7}`} />
        <Card label="Расм" value={s.media.photos} />
        <Card label="Видео" value={s.media.videos} />
      </div>

      <div style={box}><h3 style={h}>Сўнгги 14 кун</h3><Daily rows={s.daily} /></div>
      <div style={box}><h3 style={h}>Вилоятлар бўйича жойлар</h3><Bars rows={s.byRegion} color="#14575f" /></div>
      <div style={box}><h3 style={h}>Энг кўп балиқ тури</h3><Bars rows={s.byFish} color="#e8803a" /></div>

      <div style={box}>
        <h3 style={h}>Энг фаол жой қўшувчилар</h3>
        {s.top.map((t, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #e3eceb", fontSize: 14 }}>
            <span>{i + 1}. {t.name}{t.username ? ` @${t.username}` : ""}</span>
            <b>{t.spots} жой · {t.comments} коммент</b>
          </div>
        ))}
      </div>

      <div style={box}>
        <h3 style={h}>Сўнгги фойдаланувчилар</h3>
        {s.recent.map((r, i) => (
          <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #e3eceb", fontSize: 14 }}>
            <b>{r.name}</b>{r.username ? ` @${r.username}` : ""}
            <div style={{ fontSize: 12, color: "#58706f" }}>Охирги: {fmt(r.last_seen)} · Биринчи: {fmt(r.first_seen)} · {r.opens} марта</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: "#58706f", marginTop: 14 }}>Фойдаланувчи ҳисоби статистика ёқилган пайтдан бошлаб юритилади; эски эгалар жой ва комментлари бўйича қўшилган.</p>
    </div>
  );
}
