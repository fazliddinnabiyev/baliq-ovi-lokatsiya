"use client";

import { openExternal } from "@/lib/client";
import { googleRoute, navApps } from "@/lib/directions";

type Props = { lat: number; lng: number; title?: string; onClose: () => void };

/** Qanday boriladi oynasi: Google Xarita va navigatorlar bir xil ro'yxatda. */
export default function Directions({ lat, lng, title, onClose }: Props) {
  return (
    <div className="dirOverlay" onClick={onClose}>
      <div className="dirPanel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Qanday boriladi">
        <div className="grab" aria-hidden="true" />
        <h3 className="dirTitle">Qanday boriladi{title ? `: ${title}` : ""}</h3>

        <p className="dirSub">Qaysi ilovada ochilsin?</p>
        <div className="dirList">
          {[{ id: "google", name: "Google Xarita", url: googleRoute(lat, lng) }, ...navApps(lat, lng)].map((a) => (
            <button key={a.id} className="dirItem" onClick={() => openExternal(a.url)}>
              {a.name}
            </button>
          ))}
        </div>

        <p className="hint">Yo'l hozirgi joylashuvingizdan boshlanadi. Ilova telefoningizda o'rnatilgan bo'lsa ochiladi.</p>
        <button className="danger dirClose" onClick={onClose}>
          Yopish
        </button>
      </div>
    </div>
  );
}
