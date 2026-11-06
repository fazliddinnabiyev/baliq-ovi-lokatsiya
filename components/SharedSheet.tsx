"use client";

import { useState } from "react";
import { api, openLink } from "@/lib/client";
import { NONE, isFish } from "@/lib/fish";
import { regionShort } from "@/lib/regions";
import type { Spot } from "@/lib/types";
import Directions from "./Directions";

type Props = {
  spot: Spot;
  token: string;
  onClose: () => void;
  onCopied: (spot: Spot) => void;
  toast: (msg: string) => void;
};

/** Do'st ulashgan joy: faqat ko'rish, yo'nalish olish va o'z ro'yxatiga saqlash. */
export default function SharedSheet({ spot, token, onClose, onCopied, toast }: Props) {
  const [dir, setDir] = useState(false);
  const [saving, setSaving] = useState(false);

  async function copy() {
    setSaving(true);
    try {
      const mine = await api<Spot>(`/api/shared/${token}`, { method: "POST" });
      toast("Joylaringizga saqlandi ✓");
      onCopied(mine);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const rows: [string, string, string | null][] = [
    ["🥇", "Eng ko'p", spot.fishMost],
    ["🥈", "O'rtacha", spot.fishMid],
    ["🥉", "Eng kam", spot.fishLeast],
  ];

  return (
    <div className="sheet">
      <div className="grab" aria-hidden="true" />
      <div className="sheetHead">
        <div className="nameInput sharedName">{spot.name || "Do'st ulashgan joy"}</div>
        <button className="iconBtn" onClick={onClose} aria-label="Yopish">
          ✕
        </button>
      </div>
      <div className="coords">
        <span>
          📍 {spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}
        </span>
        {spot.region && <span className="regionTag">{regionShort(spot.region)}</span>}
      </div>

      <div className="quick">
        <button className="primary" onClick={() => setDir(true)}>
          🧭 Yo'nalish
        </button>
        <button className="ghost" onClick={copy} disabled={saving}>
          {saving ? "Saqlanmoqda..." : "➕ Joylarimga saqlash"}
        </button>
      </div>

      <div className="section">
        <h3>🐟 Baliq</h3>
        {rows.map(([icon, label, value]) => (
          <div key={label} className="row">
            <span className="rowLabel">
              {icon} {label}
            </span>
            <strong>{value && (isFish(value) || value === NONE) ? value : "—"}</strong>
          </div>
        ))}
      </div>

      {spot.bait && (
        <div className="section">
          <h3>🪱 Yem</h3>
          <p className="readText">{spot.bait}</p>
        </div>
      )}

      {spot.times.length > 0 && (
        <div className="section">
          <h3>🕒 Qachon yaxshi</h3>
          <div className="chips">
            {spot.times.map((t) => (
              <span key={t} className="chip chipOn">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {spot.note && (
        <div className="section">
          <h3>📝 Izoh</h3>
          <p className="readText">{spot.note}</p>
        </div>
      )}

      {spot.media.length > 0 && (
        <div className="section">
          <h3>📷 Rasm va videolar</h3>
          <div className="mediaGrid">
            {spot.media.map((m) => (
              <button key={m.id} className="thumb" onClick={() => openLink(m.url)}>
                {m.kind === "video" ? (
                  <>
                    <video src={`${m.url}#t=0.1`} preload="metadata" muted playsInline />
                    <span className="play">▶</span>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt="" loading="lazy" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {dir && <Directions lat={spot.lat} lng={spot.lng} title={spot.name || undefined} onClose={() => setDir(false)} />}
    </div>
  );
}
