"use client";

import { useState } from "react";
import { cyr } from "@/lib/cyr";
import { api, openLink, openTelegramLink } from "@/lib/client";
import { NONE, isFish } from "@/lib/fish";
import { regionShort } from "@/lib/regions";
import type { Spot } from "@/lib/types";
import Comments from "./Comments";
import Directions from "./Directions";

type Props = {
  spot: Spot;
  onClose: () => void;
  toast: (msg: string) => void;
};

/** Boshqa foydalanuvchining joyi: faqat ko'rish, yo'nalish va komment. */
export default function ViewSheet({ spot, onClose, toast }: Props) {
  const [dir, setDir] = useState(false);

  async function share() {
    try {
      const { url } = await api<{ url: string }>(`/api/spots/${spot.id}/share`, { method: "POST" });
      const text = `🎣 ${spot.name || "Балиқ ови жойи"}: ботга Start босинг, жой очилади`;
      openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const rows: [string, string, string | null][] = [
    ["🥇", "Энг кўп", spot.fishMost],
    ["🥈", "Ўртача", spot.fishMid],
    ["🥉", "Энг кам", spot.fishLeast],
  ];

  return (
    <div className="sheet">
      <div className="grab" aria-hidden="true" />
      <div className="sheetHead">
        <div className="nameInput sharedName">{spot.name || `Жой #${spot.id}`}</div>
        <button className="iconBtn" onClick={onClose} aria-label="Ёпиш">
          ✕
        </button>
      </div>
      <div className="coords">
        <span>
          📍 {spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}
        </span>
        {spot.region && <span className="regionTag">{cyr(regionShort(spot.region))}</span>}
      </div>
      <div className="byline">
        <span className="avatar" aria-hidden="true">
          {(spot.ownerName || "?").slice(0, 1).toUpperCase()}
        </span>
        <span>
          <b>{spot.ownerName || "Фойдаланувчи"}</b>  қўшган
        </span>
      </div>

      <div className="quick">
        <button className="primary" onClick={() => setDir(true)}>
          
          🧭 Қандай борилади
        </button>
        <button className="ghost" onClick={share}>
          
          📤 Улашиш
        </button>
      </div>

      <div className="section">
        <h3>🐟 Балиқ</h3>
        {rows.map(([icon, label, value]) => (
          <div key={label} className="row">
            <span className="rowLabel">
              {icon} {label}
            </span>
            <strong>{value && (isFish(value) || value === NONE) ? cyr(value) : "—"}</strong>
          </div>
        ))}
      </div>

      {spot.bait && (
        <div className="section">
          <h3>🪱 Ем</h3>
          <p className="readText">{spot.bait}</p>
        </div>
      )}

      {spot.times.length > 0 && (
        <div className="section">
          <h3>🕒 Қачон яхши</h3>
          <div className="chips">
            {spot.times.map((t) => (
              <span key={t} className="chip chipOn">
                {cyr(t)}
              </span>
            ))}
          </div>
        </div>
      )}

      {spot.note && (
        <div className="section">
          <h3>📝 Изоҳ</h3>
          <p className="readText">{spot.note}</p>
        </div>
      )}

      {spot.media.length > 0 && (
        <div className="section">
          <h3>📷 Расм ва видеолар</h3>
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

      <Comments spotId={spot.id} isOwner={false} toast={toast} />

      {dir && <Directions lat={spot.lat} lng={spot.lng} title={spot.name || undefined} onClose={() => setDir(false)} />}
    </div>
  );
}
