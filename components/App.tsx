"use client";

import "leaflet/dist/leaflet.css";
import type * as LeafletTypes from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import { DEFAULT_PIN_COLOR, FISH, FISH_COLORS } from "@/lib/fish";
import { OTHER_REGION, REGIONS, regionShort } from "@/lib/regions";
import type { Spot } from "@/lib/types";
import SpotSheet from "./SpotSheet";

// O'zbekiston chegaralari (janubi-g'arb, shimoli-sharq)
const UZ_BOUNDS: LeafletTypes.LatLngBoundsExpression = [
  [37.1, 55.9],
  [45.6, 73.2],
];

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

function blankSpot(lat: number, lng: number): Spot {
  const now = new Date().toISOString();
  return {
    id: 0,
    lat,
    lng,
    name: "",
    region: null,
    fishMost: null,
    fishMid: null,
    fishLeast: null,
    bait: "",
    times: [],
    note: "",
    createdAt: now,
    updatedAt: now,
    media: [],
  };
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

/** Kichik tomchi shaklidagi belgi; rangi eng ko'p baliq turiga qarab. */
function pinIcon(L: typeof LeafletTypes, color: string, selected: boolean) {
  return L.divIcon({
    className: "",
    html: `<div class="pinW ${selected ? "pinSel" : ""}"><i class="pin" style="--c:${color}"></i></div>`,
    iconSize: [26, 30],
    iconAnchor: [13, 27],
  });
}

function spotColor(s: Spot): string {
  return (s.fishMost && FISH_COLORS[s.fishMost]) || DEFAULT_PIN_COLOR;
}

export default function App() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [fishFilter, setFishFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [newSpot, setNewSpot] = useState<{ lat: number; lng: number } | null>(null);
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

  // Xaritadan bosib joy qo'shish: avval varaq ochiladi, baliq turlari tanlangach saqlanadi
  const onMapClick = useRef<(lat: number, lng: number) => void>(() => {});
  onMapClick.current = (lat, lng) => {
    setAdding(false);
    setSelectedId(null);
    setNewSpot({ lat, lng });
  };

  // Yangi (hali saqlanmagan) joy uchun vaqtinchalik belgi
  const tempMarker = useRef<LeafletTypes.Marker | null>(null);
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    tempMarker.current?.remove();
    tempMarker.current = null;
    if (!L || !map || !newSpot) return;
    tempMarker.current = L.marker([newSpot.lat, newSpot.lng], {
      icon: pinIcon(L, "#e4473a", true),
      zIndexOffset: 2000,
    }).addTo(map);
    window.scrollTo({ top: 0, behavior: "smooth" });
    map.invalidateSize();
    if (map.getZoom() < 12) map.setView([newSpot.lat, newSpot.lng], 14, { animate: true });
    else map.panTo([newSpot.lat, newSpot.lng], { animate: true });
    return () => {
      tempMarker.current?.remove();
      tempMarker.current = null;
    };
  }, [newSpot, ready]);

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
      // Yengil va tinch ranglardagi xarita (qorong'i rejimda qorong'isi)
      const dark = document.documentElement.dataset.theme === "dark";
      const base = L.tileLayer(
        `https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "rastermaps/voyager"}/{z}/{x}/{y}{r}.png`,
        { maxZoom: 19, subdomains: "abcd" }
      );
      const sat = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 }
      );
      base.addTo(map);
      L.control.layers({ Xarita: base, "Sun'iy yo'ldosh": sat }, undefined, { position: "topright" }).addTo(map);
      L.control
        .attribution({ position: "bottomright", prefix: false })
        .addAttribution("© OpenStreetMap, CARTO, Esri")
        .addTo(map);
      map.on("click", (e: LeafletTypes.LeafletMouseEvent) => {
        if (addingRef.current) onMapClick.current(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      map.fitBounds(UZ_BOUNDS, { animate: false });
      setReady(true);
      setTimeout(() => {
        map.invalidateSize();
        map.fitBounds(UZ_BOUNDS, { animate: false });
      }, 120);
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
      const icon = pinIcon(L, spotColor(s), s.id === selectedId);
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

  const fitUz = useCallback(() => {
    mapRef.current?.fitBounds(UZ_BOUNDS, { animate: true });
  }, []);

  // Birinchi yuklanganda: ?spot=ID bo'lsa shu joy, aks holda butun O'zbekiston ko'rinadi
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !loaded || fittedRef.current) return;
    fittedRef.current = true;

    const params = new URLSearchParams(window.location.search);

    // Botga lokatsiya yuborilganda: ?new=lat,lng — yangi joy varag'i shu nuqta bilan ochiladi
    const [lat, lng] = (params.get("new") || "").split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      setNewSpot({ lat, lng });
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    const want = Number(params.get("spot"));
    const target = spots.find((s) => s.id === want);
    if (target) setSelectedId(target.id);
  }, [ready, loaded, spots]);

  // Varaq ochiq turganda orqa sahifa qotadi
  useEffect(() => {
    document.body.style.overflow = selectedId !== null || newSpot ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedId, newSpot]);

  // Joy tanlanganda: xarita unga uchadi, sahifa tepaga suriladi
  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedId === null) return;
    const s = spots.find((x) => x.id === selectedId);
    if (s) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      map.invalidateSize();
      map.setView([s.lat, s.lng], Math.max(map.getZoom(), 15), { animate: true });
    }
    // faqat tanlov o'zgarganda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selected = useMemo(() => spots.find((s) => s.id === selectedId) ?? null, [spots, selectedId]);

  // Filtrlar: viloyat va baliq turi birga ishlaydi; tugmalardagi sonlar ikkinchi filtrga moslanadi
  const hasFish = (s: Spot, f: string) => !f || allFish(s).includes(f);

  const regionChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of spots) {
      if (!hasFish(s, fishFilter)) continue;
      const r = s.region || OTHER_REGION;
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    const order: string[] = [...REGIONS, OTHER_REGION];
    return order
      .filter((r) => counts.has(r) || r === regionFilter)
      .map((r) => [r, counts.get(r) ?? 0] as [string, number]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots, fishFilter, regionFilter]);

  const fishCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of FISH) {
      m.set(f, spots.filter((s) => (!regionFilter || (s.region || OTHER_REGION) === regionFilter) && hasFish(s, f)).length);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots, regionFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return spots.filter((s) => {
      if (regionFilter && (s.region || OTHER_REGION) !== regionFilter) return false;
      if (!hasFish(s, fishFilter)) return false;
      if (!q) return true;
      return [s.name, s.note, s.bait, s.region, ...allFish(s), `joy #${s.id}`]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [spots, search, fishFilter, regionFilter]);

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
        <div className="mapTools">
          <button className="mapBtn" onClick={fitUz}>
            O'zbekiston
          </button>
          <button className="mapBtn" onClick={fitAll} disabled={spots.length === 0}>
            Joylarim
          </button>
        </div>
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

        {spots.length > 0 && (
          <>
            <div className="filterLabel">Viloyat</div>
            <div className="filters" role="group" aria-label="Viloyat bo'yicha filtr">
              <button className={`fchip ${regionFilter === "" ? "fchipOn" : ""}`} onClick={() => setRegionFilter("")}>
                Hammasi
              </button>
              {regionChips.map(([name, n]) => (
                <button
                  key={name}
                  className={`fchip ${regionFilter === name ? "fchipOn" : ""}`}
                  onClick={() => setRegionFilter(regionFilter === name ? "" : name)}
                >
                  {regionShort(name) || name} <b>{n}</b>
                </button>
              ))}
            </div>

            <div className="filterLabel">Baliq turi</div>
            <div className="filters" role="group" aria-label="Baliq turi bo'yicha filtr">
              <button className={`fchip ${fishFilter === "" ? "fchipOn" : ""}`} onClick={() => setFishFilter("")}>
                Hammasi
              </button>
              {FISH.map((name) => (
                <button
                  key={name}
                  className={`fchip ${fishFilter === name ? "fchipOn" : ""}`}
                  onClick={() => setFishFilter(fishFilter === name ? "" : name)}
                >
                  <i className="dot" style={{ background: FISH_COLORS[name] }} />
                  {name} <b>{fishCounts.get(name) ?? 0}</b>
                </button>
              ))}
            </div>
          </>
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
                      <span className="warn">Baliq turlarini to'ldiring</span>
                    )}
                    <span className="rowMeta">
                      {s.region && <span className="regionTag">{regionShort(s.region)}</span>}
                      {s.times.join(", ")}
                    </span>
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

      {newSpot ? (
        <SpotSheet
          key={`new-${newSpot.lat}-${newSpot.lng}`}
          isNew
          spot={blankSpot(newSpot.lat, newSpot.lng)}
          onClose={() => setNewSpot(null)}
          onSaved={onSaved}
          onCreated={(s) => {
            setSpots((prev) => [s, ...prev]);
            setNewSpot(null);
            setSelectedId(s.id);
          }}
          onDeleted={onDeleted}
          toast={toast}
        />
      ) : (
        selected && (
          <SpotSheet
            key={selected.id}
            spot={selected}
            onClose={() => setSelectedId(null)}
            onSaved={onSaved}
            onDeleted={onDeleted}
            toast={toast}
          />
        )
      )}

      {message && <div className="toast">{message}</div>}
    </div>
  );
}
