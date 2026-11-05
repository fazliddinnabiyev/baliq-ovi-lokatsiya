"use client";

import "leaflet/dist/leaflet.css";
import type * as LeafletTypes from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { Spot } from "@/lib/types";
import SpotSheet from "./SpotSheet";

const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

function shortDate(iso: string): string {
  const d = new Date(iso);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

function spotTitle(s: Spot): string {
  return s.name || `Joy #${s.id}`;
}

function allFish(s: Spot): string[] {
  return [s.fishMost, s.fishMid, s.fishLeast].filter((x): x is string => !!x);
}

function Level({ n }: { n: number }) {
  return (
    <span className="lvl" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= n ? "on" : ""} />
      ))}
    </span>
  );
}

function bobberIcon(L: typeof LeafletTypes, selected: boolean) {
  return L.divIcon({
    className: "",
    html: `<div class="bob ${selected ? "bobSel" : ""}"><i></i></div>`,
    iconSize: [26, 40],
    iconAnchor: [13, 36],
  });
}

export default function App() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [fishFilter, setFishFilter] = useState("");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletTypes.Map | null>(null);
  const LRef = useRef<typeof LeafletTypes | null>(null);
  const markersRef = useRef<Map<number, LeafletTypes.Marker>>(new Map());
  const addingRef = useRef(false);
  const fittedRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string) => {
    setMessage(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(""), 2600);
  }, []);

  // Telegram: tayyorlash, mavzu (yorug'/qorong'i), pastga surib yopishni o'chirish
  useEffect(() => {
    const w = window.Telegram?.WebApp;
    try {
      w?.ready?.();
      w?.expand?.();
      w?.disableVerticalSwipes?.();
    } catch {
      /* eski Telegram versiyasi */
    }
    const apply = () => {
      const dark = w?.colorScheme
        ? w.colorScheme === "dark"
        : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      try {
        const color = dark ? "#0c1a1d" : "#eef3f1";
        w?.setHeaderColor?.(color);
        w?.setBackgroundColor?.(color);
      } catch {
        /* ixtiyoriy */
      }
    };
    apply();
    w?.onEvent?.("themeChanged", apply);
    return () => w?.offEvent?.("themeChanged", apply);
  }, []);

  // Joylarni yuklash
  useEffect(() => {
    if (!window.Telegram?.WebApp?.initData) {
      setError("Bu ilovani Telegram ichidagi bot orqali oching.");
      setLoaded(true);
      return;
    }
    api<Spot[]>("/api/spots")
      .then(setSpots)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);

  // Xaritadan bosib joy qo'shish
  const onMapClick = useRef<(lat: number, lng: number) => void>(() => {});
  onMapClick.current = async (lat, lng) => {
    setAdding(false);
    try {
      const s = await api<Spot>("/api/spots", { method: "POST", body: JSON.stringify({ lat, lng }) });
      setSpots((prev) => [s, ...prev]);
      setSelectedId(s.id);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  useEffect(() => {
    addingRef.current = adding;
  }, [adding]);

  // Xaritani yaratish
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("leaflet");
      const L = ((mod as unknown as { default?: typeof LeafletTypes }).default ?? mod) as typeof LeafletTypes;
      if (cancelled || !mapEl.current || mapRef.current) return;
      LRef.current = L;

      const map = L.map(mapEl.current, { zoomControl: false, attributionControl: false }).setView(
        [41.3, 69.27],
        6
      );
      const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 });
      const sat = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 }
      );
      osm.addTo(map);
      L.control.layers({ Xarita: osm, "Sun'iy yo'ldosh": sat }, undefined, { position: "topright" }).addTo(map);
      L.control.attribution({ position: "bottomright", prefix: false }).addAttribution("© OpenStreetMap, Esri").addTo(map);
      map.on("click", (e: LeafletTypes.LeafletMouseEvent) => {
        if (addingRef.current) onMapClick.current(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      setReady(true);
      setTimeout(() => map.invalidateSize(), 100);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Markerlarni yangilash
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const seen = new Set<number>();
    for (const s of spots) {
      seen.add(s.id);
      const icon = bobberIcon(L, s.id === selectedId);
      let marker = markersRef.current.get(s.id);
      if (!marker) {
        marker = L.marker([s.lat, s.lng], { icon }).addTo(map);
        marker.on("click", () => setSelectedId(s.id));
        markersRef.current.set(s.id, marker);
      } else {
        marker.setLatLng([s.lat, s.lng]);
        marker.setIcon(icon);
      }
      marker.setZIndexOffset(s.id === selectedId ? 1000 : 0);
    }
    markersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });
  }, [spots, ready, selectedId]);

  const fitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map || spots.length === 0) return;
    map.fitBounds(
      spots.map((s) => [s.lat, s.lng] as [number, number]),
      { padding: [40, 40], maxZoom: 14 }
    );
  }, [spots]);

  // Birinchi yuklanganda: ?spot=ID yoki hamma joylarni ko'rsatish
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !loaded || fittedRef.current) return;
    fittedRef.current = true;

    const want = Number(new URLSearchParams(window.location.search).get("spot"));
    const target = spots.find((s) => s.id === want);
    if (target) setSelectedId(target.id);
    else fitAll();
  }, [ready, loaded, spots, fitAll]);

  // Joy tanlanganda: xarita unga uchadi, sahifa tepaga suriladi, orqa fon qotadi
  useEffect(() => {
    document.body.style.overflow = selectedId !== null ? "hidden" : "";
    const map = mapRef.current;
    if (!map || selectedId === null) return () => {
      document.body.style.overflow = "";
    };
    const s = spots.find((x) => x.id === selectedId);
    if (s) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      map.invalidateSize();
      map.setView([s.lat, s.lng], Math.max(map.getZoom(), 15), { animate: true });
    }
    return () => {
      document.body.style.overflow = "";
    };
    // faqat tanlov o'zgarganda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selected = useMemo(() => spots.find((s) => s.id === selectedId) ?? null, [spots, selectedId]);

  // Baliq bo'yicha filtr tugmalari (nomi va nechta joyda uchrashi)
  const fishChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of spots) for (const f of allFish(s)) counts.set(f, (counts.get(f) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [spots]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return spots.filter((s) => {
      if (fishFilter && !allFish(s).includes(fishFilter)) return false;
      if (!q) return true;
      return [s.name, s.note, s.bait, ...allFish(s), `joy #${s.id}`]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [spots, search, fishFilter]);

  const onSaved = useCallback((updated: Spot) => {
    setSpots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }, []);

  const onDeleted = useCallback((id: number) => {
    setSpots((prev) => prev.filter((s) => s.id !== id));
    setSelectedId(null);
  }, []);

  return (
    <div className="page">
      <header className="head">
        <h1>Baliq joylarim</h1>
        <span className="count">{spots.length} ta joy</span>
      </header>

      <section className="mapCard">
        <div ref={mapEl} className="map" />
        <button className="mapBtn fitBtn" onClick={fitAll} disabled={spots.length === 0} aria-label="Hamma joyni ko'rsatish">
          Hammasi
        </button>
        <button
          className={`mapBtn addBtn ${adding ? "addOn" : ""}`}
          onClick={() => setAdding((v) => !v)}
          aria-pressed={adding}
        >
          {adding ? "Bekor qilish" : "＋ Xaritadan belgilash"}
        </button>
        {adding && <div className="mapHint">Joy qo'shish uchun xaritaning kerakli nuqtasini bosing</div>}
      </section>

      {error && <div className="notice error">{error}</div>}

      <section className="listBlock">
        <input
          className="search"
          type="search"
          placeholder="Nom, baliq, yem yoki izoh bo'yicha qidiring"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {fishChips.length > 0 && (
          <div className="filters" role="group" aria-label="Baliq bo'yicha filtr">
            <button className={`fchip ${fishFilter === "" ? "fchipOn" : ""}`} onClick={() => setFishFilter("")}>
              Hammasi
            </button>
            {fishChips.map(([name, n]) => (
              <button
                key={name}
                className={`fchip ${fishFilter === name ? "fchipOn" : ""}`}
                onClick={() => setFishFilter(fishFilter === name ? "" : name)}
              >
                {name} <b>{n}</b>
              </button>
            ))}
          </div>
        )}

        {loaded && !error && spots.length === 0 && (
          <div className="notice">
            <strong>Hali joy yo'q.</strong>
            <span>Botga lokatsiya yuboring yoki xaritada "Xaritadan belgilash" tugmasini bosing.</span>
          </div>
        )}

        {spots.length > 0 && filtered.length === 0 && <div className="notice">Hech narsa topilmadi.</div>}

        {filtered.length > 0 && (
          <div className="spotList">
            {filtered.map((s) => {
              const cover = s.media.find((m) => m.kind === "image");
              const fish: [string | null, number][] = [
                [s.fishMost, 3],
                [s.fishMid, 2],
                [s.fishLeast, 1],
              ];
              return (
                <button key={s.id} className="spotRow" onClick={() => setSelectedId(s.id)}>
                  <span className="cover">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover.url} alt="" loading="lazy" />
                    ) : (
                      <span className="coverEmpty">🎣</span>
                    )}
                  </span>
                  <span className="rowBody">
                    <span className="rowTitle">{spotTitle(s)}</span>
                    {allFish(s).length > 0 ? (
                      <span className="fishLine">
                        {fish.map(
                          ([name, n]) =>
                            name && (
                              <span key={name} className="fish">
                                {name}
                                <Level n={n} />
                              </span>
                            )
                        )}
                      </span>
                    ) : (
                      <span className="rowMeta">Baliq tanlanmagan</span>
                    )}
                    {s.times.length > 0 && <span className="rowMeta">{s.times.join(", ")}</span>}
                  </span>
                  <span className="rowSide">
                    <span>{shortDate(s.createdAt)}</span>
                    {s.media.length > 0 && <span className="mediaCount">📷 {s.media.length}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selected && (
        <SpotSheet
          key={selected.id}
          spot={selected}
          onClose={() => setSelectedId(null)}
          onSaved={onSaved}
          onDeleted={onDeleted}
          toast={toast}
        />
      )}

      {message && <div className="toast">{message}</div>}
    </div>
  );
}
