"use client";

import { openExternal } from "@/lib/client";
import { googleRoute, navApps } from "@/lib/directions";

type Props = { lat: number; lng: number; title?: string; onClose: () => void };

/** Yo'nalish oynasi: birinchi Google Xarita, pastda O'zbekistonda keng tarqalgan navigatorlar. */
export default function Directions({ lat, lng, title, onClose }: Props) {
  return (
    <div className="dirOverlay" onClick={onClose}>
      <div className="dirPanel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Yo'nalish">
        <div className="grab" aria-hidden="true" />
        <h3 className="dirTitle">Yo'nalish{title ? `: ${title}` : ""}</h3>

        <button className="dirGoogle" onClick={() => openExternal(googleRoute(lat, lng))}>
          Google Xaritada yo'nalish
        </button>

        <p className="dirSub">Boshqa navigatorlarda ochish</p>
        <div className="dirList">
          {navApps(lat, lng).map((a) => (
            <button key={a.id} className="dirItem" onClick={() => openExternal(a.url)}>
              {a.name}
            </button>
          ))}
        </div>

        <p className="hint">Yo'nalish hozirgi joylashuvingizdan boshlanadi. Ilova telefoningizda o'rnatilgan bo'lsa ochiladi.</p>
        <button className="danger dirClose" onClick={onClose}>
          Yopish
        </button>
      </div>
    </div>
  );
}
