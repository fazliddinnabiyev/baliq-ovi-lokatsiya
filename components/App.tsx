"use client";

import "leaflet/dist/leaflet.css";
import type * as LeafletTypes from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { Spot } from "@/lib/types";
import SpotSheet from "./SpotSheet";

type Mode = "map" | "list";

export default function App() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("map");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
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

  // Telegram'ni tayyorlash
  useEffect(() => {
    const w = window.Telegram?.WebApp;
    w?.ready?.();
    w?.expand?.();
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

  // Xaritani yaratish
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("leaflet");
      const L = ((mod as unknown as { default?: typeof LeafletTypes }).default ?? mod) as typeof LeafletTypes;
      if (cancelled || !mapEl.current || mapRef.current) return;
      LRef.current = L;

      const map = L.map(mapEl.current, { zoomControl: false }).setView([41.3, 69.27], 6);
      const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      });
      const sat = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Esri" }
      );
      osm.addTo(map);
      L.control.layers({ Xarita: osm, "Sun'iy yo'ldosh": sat }, undefined, { position: "topright" }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      map.on("click", (e: LeafletTypes.LeafletMouseEvent) => {
        if (addingRef.current) onMapClick.current(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      setReady(true);
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
      const icon = L.divIcon({
        className: "",
        html: `<div class="pin ${s.id === selectedId ? "pinSel" : ""}"><span>🎣</span></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 34],
      });
      let marker = markersRef.current.get(s.id);
      if (!marker) {
        marker = L.marker([s.lat, s.lng], { icon }).addTo(map);
        marker.on("click", () => setSelectedId(s.id));
        markersRef.current.set(s.id, marker);
      } else {
        marker.setLatLng([s.lat, s.lng]);
        marker.setIcon(icon);
      }
    }
    markersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });
  }, [spots, ready, selectedId]);

  // Birinchi yuklanganda: ?spot=ID yoki hamma joylarni ko'rsatish
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !loaded || fittedRef.current) return;
    fittedRef.current = true;

    const want = Number(new URLSearchParams(window.location.search).get("spot"));
    const target = spots.find((s) => s.id === want);
    if (target) {
      setSelectedId(target.id);
    } else if (spots.length > 0) {
      map.fitBounds(
        spots.map((s) => [s.lat, s.lng] as [number, number]),
        { padding: [50, 50], maxZoom: 14 }
      );
    }
  }, [ready, loaded, spots]);

  // Joy tanlanganda xaritani unga olib borish (pastdagi panel yopmasligi uchun biroz yuqoriroq)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedId === null) return;
    const s = spots.find((x) => x.id === selectedId);
    if (!s) return;
    map.setView([s.lat, s.lng], Math.max(map.getZoom(), 15), { animate: true });
    map.panBy([0, Math.round(window.innerHeight * 0.18)], { animate: true });
    // faqat tanlov o'zgarganda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selected = useMemo(() => spots.find((s) => s.id === selectedId) ?? null, [spots, selectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return spots;
    return spots.filter((s) =>
      [s.name, s.note, s.bait, s.fishMost, s.fishMid, s.fishLeast, `joy #${s.id}`]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [spots, search]);

  const onSaved = useCallback((updated: Spot) => {
    setSpots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }, []);

  const onDeleted = useCallback((id: number) => {
    setSpots((prev) => prev.filter((s) => s.id !== id));
    setSelectedId(null);
  }, []);

  // Xarita ko'rinishiga qaytganda o'lchamni yangilash
  useEffect(() => {
    if (mode === "map") setTimeout(() => mapRef.current?.invalidateSize(), 50);
  }, [mode]);

  return (
    <div className="app">
      <div ref={mapEl} className="map" />

      <div className="topbar">
        <button className={`tab ${mode === "map" ? "tabOn" : ""}`} onClick={() => setMode("map")}>
          🗺 Xarita
        </button>
        <button className={`tab ${mode === "list" ? "tabOn" : ""}`} onClick={() => setMode("list")}>
          📋 Ro'yxat ({spots.length})
        </button>
      </div>

      {mode === "map" && !selected && (
        <button
          className={`fab ${adding ? "fabOn" : ""}`}
          onClick={() => setAdding((v) => !v)}
          aria-label="Xaritadan joy qo'shish"
        >
          {adding ? "✕" : "＋"}
        </button>
      )}

      {adding && <div className="banner">Joyni belgilash uchun xaritaning kerakli nuqtasini bosing</div>}

      {!error && loaded && spots.length === 0 && mode === "map" && !adding && (
        <div className="banner">
          Hali joy yo'q. Botga lokatsiya yuboring yoki ＋ tugmasi bilan xaritadan belgilang.
        </div>
      )}

      {error && <div className="errorBox">{error}</div>}

      {mode === "list" && (
        <div className="list">
          <input
            className="search"
            placeholder="Qidirish: nom, baliq, yem, izoh..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {filtered.length === 0 && <p className="empty">Hech narsa topilmadi.</p>}
          {filtered.map((s) => (
            <button
              key={s.id}
              className="card"
              onClick={() => {
                setMode("map");
                setSelectedId(s.id);
              }}
            >
              <div className="cardTitle">{s.name || `Joy #${s.id}`}</div>
              <div className="cardSub">
                {s.fishMost ? `🥇 ${s.fishMost}` : "Baliq tanlanmagan"}
                {s.fishMid ? ` · 🥈 ${s.fishMid}` : ""}
                {s.fishLeast ? ` · 🥉 ${s.fishLeast}` : ""}
              </div>
              {s.times.length > 0 && <div className="cardSub">🕒 {s.times.join(", ")}</div>}
              <div className="cardSub">
                {new Date(s.createdAt).toLocaleDateString("uz-UZ")} · 📷 {s.media.length}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && mode === "map" && (
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
