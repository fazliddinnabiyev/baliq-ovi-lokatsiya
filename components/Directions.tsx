"use client";

import { useState } from "react";
import { openExternal } from "@/lib/client";
import { googleRoute, navApps } from "@/lib/directions";

type Props = { lat: number; lng: number; title?: string; onClose: () => void };

/** Qanday boriladi oynasi: Google Xarita va navigatorlar bir xil ro'yxatda. */
export default function Directions({ lat, lng, title, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  async function copyCoords() {
    const t = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(t);
      setCopied(true);
    } catch {
      window.prompt("Koordinata:", t);
    }
  }

  return (
    <div className="dirOverlay" onClick={onClose}>
      <div className="dirPanel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Qanday boriladi">
        <div className="grab" aria-hidden="true" />
        <h3 className="dirTitle">Qanday boriladi{title ? `: ${title}` : ""}</h3>

        <p className="dirSub">Qaysi ilovada ochilsin?</p>
        <div className="dirList">
          {[{ id: "google", name: "Google Xarita", url: googleRoute(lat, lng) }, ...navApps(lat, lng)].map((a) => (
            <button key={a.id} className="dirItem" onClick={() => openExternal(a.url)}>
              <span className={`dirIcon di-${a.id}`} aria-hidden="true">
                {a.name.slice(0, 1)}
              </span>
              <span className="dirName">{a.name}</span>
              <span className="dirGo" aria-hidden="true">
                ›
              </span>
            </button>
          ))}
        </div>

        <button className="ghost dirCopy" onClick={copyCoords}>
          {copied ? "✓ Nusxalandi" : "📋 Koordinatani nusxalash"}
        </button>

        <p className="hint">Yo'l hozirgi joylashuvingizdan boshlanadi. Ilova telefoningizda o'rnatilgan bo'lsa ochiladi.</p>
        <button className="danger dirClose" onClick={onClose}>
          Yopish
        </button>
      </div>
    </div>
  );
}
