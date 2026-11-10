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
      window.prompt("Координата:", t);
    }
  }

  return (
    <div className="dirOverlay" onClick={onClose}>
      <div className="dirPanel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Қандай борилади">
        <div className="grab" aria-hidden="true" />
        <h3 className="dirTitle">Қандай борилади{title ? `: ${title}` : ""}</h3>

        <p className="dirSub">Қайси иловада очилсин?</p>
        <div className="dirList">
          {[{ id: "google", name: "Гугл Харита", url: googleRoute(lat, lng) }, ...navApps(lat, lng)].map((a) => (
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
          {copied ? "✓ Нусхаланди" : "📋 Координатани нусхалаш"}
        </button>

        <p className="hint">Йўл ҳозирги жойлашувингиздан бошланади. Илова телефонингизда ўрнатилган бўлса очилади.</p>
        <button className="danger dirClose" onClick={onClose}>
          
          Ёпиш
        </button>
      </div>
    </div>
  );
}
