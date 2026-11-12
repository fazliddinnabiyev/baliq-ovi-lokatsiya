"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, initData } from "@/lib/client";
import { cyr } from "@/lib/cyr";
import { DEFAULT_PIN_COLOR, FISH, FISH_COLORS, isFish } from "@/lib/fish";
import { createLeafletEngine, type Bounds, type MapEngine } from "@/lib/mapEngine";
import { OTHER_REGION, REGIONS, regionShort } from "@/lib/regions";
import type { Spot } from "@/lib/types";
import ViewSheet from "./ViewSheet";
import SpotSheet from "./SpotSheet";

// O'zbekiston chegaralari (janubi-g'arb, shimoli-sharq)
const UZ_BOUNDS: Bounds = [
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
  return s.name || `Жой #${s.id}`;
}

/** Haqiqiy baliq turlari ("Yo'q" hisobga olinmaydi). */
function allFish(s: Spot): string[] {
  return [s.fishMost, s.fishMid, s.fishLeast].filter((x): x is string => isFish(x));
}

/** Uchala qator ham tanlangan bo'lsa to'liq ("Yo'q" ham tanlov hisoblanadi). */
function isComplete(s: Spot): boolean {
  return !!s.fishMost && !!s.fishMid && !!s.fishLeast;
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
    ownerName: "",
    mine: true,
    commentCount: 0,
    incomplete: false,
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

const INCOMPLETE_COLOR = "#e0a526";

function spotColor(s: Spot): string {
  if (s.incomplete) return INCOMPLETE_COLOR;
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
  const [onlyMine, setOnlyMine] = useState(false);
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    api("/api/admin/check").then(() => setAdmin(true)).catch(() => {});
  }, []);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);

  const mapEl = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MapEngine | null>(null);
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
      setError("Бу иловани Телеграм ичидаги bot орқали очинг.");
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

  useEffect(() => {
    addingRef.current = adding;
  }, [adding]);

  // Egasi to'liq bo'lmagan joyni qoldirib chiqib ketsa (ilova yopildi yoki boshqa ilovaga o'tildi):
  // bot darrov, bir marta ogohlantiradi
  const hasMyIncomplete = spots.some((s) => s.mine && s.incomplete);
  useEffect(() => {
    if (!hasMyIncomplete) return;
    let sent = 0;
    const leave = () => {
      if (Date.now() - sent < 5000) return;
      sent = Date.now();
      try {
        navigator.sendBeacon(`/api/incomplete?init=${encodeURIComponent(initData())}`);
      } catch {
        /* ixtiyoriy */
      }
    };
    const onVis = () => document.visibilityState === "hidden" && leave();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", leave);
    };
  }, [hasMyIncomplete]);

  // Xaritani yaratish
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const el = mapEl.current;
      if (!el) return;
      const handlers = {
        onPinClick: (id: number) => setSelectedId(id),
        onMapClick: (lat: number, lng: number) => {
          if (addingRef.current) onMapClick.current(lat, lng);
        },
        dark: document.documentElement.dataset.theme === "dark",
      };
      const engine: MapEngine = await createLeafletEngine(el, handlers);
      if (cancelled) {
        engine.destroy();
        return;
      }
      engineRef.current = engine;
      engine.fit(UZ_BOUNDS, false);
      setReady(true);
      setTimeout(() => {
        engine.resize();
        engine.fit(UZ_BOUNDS, false);
      }, 150);
    })();
    return () => {
      cancelled = true;
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  // Yangi (hali saqlanmagan) joy: vaqtinchalik belgi va xarita shu nuqtaga o'tadi
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    const t = newSpot;
    e.setTemp(t);
    if (!t) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    e.resize();
    if (e.zoom() < 12) e.focus(t.lat, t.lng, 14);
    else e.pan(t.lat, t.lng);
  }, [newSpot, ready]);

  const fitUz = useCallback(() => {
    engineRef.current?.fit(UZ_BOUNDS, true);
  }, []);

  // Birinchi yuklanganda: ?new=lat,lng yoki ?spot=ID bo'lsa shu, aks holda butun O'zbekiston ko'rinadi
  useEffect(() => {
    if (!engineRef.current || !ready || !loaded || fittedRef.current) return;
    fittedRef.current = true;

    const params = new URLSearchParams(window.location.search);

    // Eski tugmalardan: ?new=lat,lng, yangi joy varag'i shu nuqta bilan ochiladi
    const [lat, lng] = (params.get("new") || "").split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      setNewSpot({ lat, lng });
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    // Do'st ulashgan joy: ?shared=token
    const token = params.get("shared") || "";
    if (/^[a-f0-9]{16}$/.test(token)) {
      window.history.replaceState(null, "", window.location.pathname);
      api<Spot>(`/api/shared/${token}`)
        .then((spot) => {
          setSpots((prev) => (prev.some((x) => x.id === spot.id) ? prev : [spot, ...prev]));
          setSelectedId(spot.id);
        })
        .catch(() => toast("Улашилган жой топилмади"));
      return;
    }

    const want = Number(params.get("spot"));
    const target = spots.find((s) => s.id === want);
    if (target) {
      setSelectedId(target.id);
      return;
    }

    // Aks holda: o'zining to'liq bo'lmagan joyi bo'lsa, ilova to'g'ridan-to'g'ri shunga kiradi
    const mineIncomplete = spots.find((s) => s.mine && s.incomplete);
    if (mineIncomplete) setSelectedId(mineIncomplete.id);
  }, [ready, loaded, spots, toast]);

  // Varaq ochiq turganda orqa sahifa qotadi
  useEffect(() => {
    document.body.style.overflow = selectedId !== null || newSpot ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedId, newSpot]);

  // Joy tanlanganda: xarita unga uchadi, sahifa tepaga suriladi
  useEffect(() => {
    const e = engineRef.current;
    if (!e || selectedId === null) return;
    const s = spots.find((x) => x.id === selectedId);
    if (s) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      e.resize();
      e.focus(s.lat, s.lng, 15);
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
      if (onlyMine && !s.mine) return false;
      if (regionFilter && (s.region || OTHER_REGION) !== regionFilter) return false;
      if (!hasFish(s, fishFilter)) return false;
      if (!q) return true;
      return [s.name, s.note, s.bait, s.region, cyr(s.region), s.ownerName, ...allFish(s), ...allFish(s).map(cyr), `жой #${s.id}`]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [spots, search, fishFilter, regionFilter, onlyMine]);

  // Xaritada faqat filtrga tushganlar ko'rinadi (tanlangan joy doim ko'rinadi)
  useEffect(() => {
    const visible = filtered;
    const sel = selectedId !== null && !visible.some((s) => s.id === selectedId) ? spots.find((s) => s.id === selectedId) : null;
    engineRef.current?.setPins(
      (sel ? [...visible, sel] : visible).map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, color: spotColor(s), incomplete: s.incomplete })),
      selectedId
    );
  }, [filtered, spots, ready, selectedId]);

  const fitAll = useCallback(() => {
    if (!engineRef.current || filtered.length === 0) return;
    const lats = filtered.map((s) => s.lat);
    const lngs = filtered.map((s) => s.lng);
    engineRef.current.fit(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      true,
      14
    );
  }, [filtered]);

  // Mening joylashuvim
  const watchRef = useRef<number | null>(null);
  const [locating, setLocating] = useState(false);
  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      toast("Бу қурилмада жойлашув аниқланмайди");
      return;
    }
    setLocating(true);
    let first = true;
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        engineRef.current?.setMe({ lat, lng, accuracy });
        if (first) {
          first = false;
          setLocating(false);
          engineRef.current?.focus(lat, lng, 13);
        }
      },
      () => {
        setLocating(false);
        toast("Жойлашув рухсати берилмади. Телефон созламаларида Телеграм учун жойлашувни ёқинг.");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
  }, [toast]);

  useEffect(
    () => () => {
      if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
    },
    []
  );

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
        <h1>Балиқ жойлари</h1>
        <span className="count">{spots.length}  та жой</span>
        {admin && (
          <a className="adminBtn" href="/admin">
            📊
          </a>
        )}
      </header>

      <section className="mapCard">
        <div ref={mapEl} className="map" />
        <div className="mapTools">
          <button className="mapBtn" onClick={fitUz}>
            
            Ўзбекистон
          </button>
          <button className="mapBtn" onClick={fitAll} disabled={filtered.length === 0}>
            
            Жойлар
          </button>
          <button className="mapBtn" onClick={locateMe} disabled={locating}>
            {locating ? "Aniqlanmoqda..." : "📍 Мен"}
          </button>
        </div>
        <button
          className={`mapBtn addBtn ${adding ? "addOn" : ""}`}
          onClick={() => setAdding((v) => !v)}
          aria-pressed={adding}
        >
          {adding ? "Бекор қилиш" : "＋ Харитадан белгилаш"}
        </button>
        {adding && <div className="mapHint">Жой қўшиш учун хаританинг керакли нуқтасини босинг</div>}
      </section>

      {error && <div className="notice error">{error}</div>}

      <section className="listBlock">
        <input
          className="search"
          type="search"
          placeholder="Ном, балиқ, ем ёки изоҳ бўйича қидиринг"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {spots.length > 0 && (
          <>
            <div className="filters" role="group" aria-label="Кимнинг жойлари">
              <button className={`fchip ${!onlyMine ? "fchipOn" : ""}`} onClick={() => setOnlyMine(false)}>
                
                Ҳамма жойлар
              </button>
              <button className={`fchip ${onlyMine ? "fchipOn" : ""}`} onClick={() => setOnlyMine(true)}>
                
                Менинг жойларим <b>{spots.filter((s) => s.mine).length}</b>
              </button>
            </div>

            <div className="filterLabel">Вилоят</div>
            <div className="filters" role="group" aria-label="Вилоят бўйича филтр">
              <button className={`fchip ${regionFilter === "" ? "fchipOn" : ""}`} onClick={() => setRegionFilter("")}>
                
                Ҳаммаси
              </button>
              {regionChips.map(([name, n]) => (
                <button
                  key={name}
                  className={`fchip ${regionFilter === name ? "fchipOn" : ""}`}
                  onClick={() => setRegionFilter(regionFilter === name ? "" : name)}
                >
                  {cyr(regionShort(name) || name)} <b>{n}</b>
                </button>
              ))}
            </div>

            <div className="filterLabel">Балиқ тури</div>
            <div className="filters" role="group" aria-label="Балиқ тури бўйича филтр">
              <button className={`fchip ${fishFilter === "" ? "fchipOn" : ""}`} onClick={() => setFishFilter("")}>
                
                Ҳаммаси
              </button>
              {FISH.map((name) => (
                <button
                  key={name}
                  className={`fchip ${fishFilter === name ? "fchipOn" : ""}`}
                  onClick={() => setFishFilter(fishFilter === name ? "" : name)}
                >
                  <i className="dot" style={{ background: FISH_COLORS[name] }} />
                  {cyr(name)} <b>{fishCounts.get(name) ?? 0}</b>
                </button>
              ))}
            </div>
          </>
        )}

        {loaded && !error && spots.length === 0 && (
          <div className="notice">
            <strong>Ҳали жой йўқ.</strong>
            <span>Биринчи бўлиб жой қўшинг: ботга локация юборинг ёки "Харитадан белгилаш" ни босинг.</span>
          </div>
        )}

        {spots.length > 0 && filtered.length === 0 && <div className="notice">Ҳеч нарса топилмади.</div>}

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
                    <span className="rowMeta">
                      {s.mine ? "Сиз қўшгансиз" : s.ownerName || "Фойдаланувчи"}
                      {s.commentCount > 0 && ` · 💬 ${s.commentCount}`}
                    </span>
                    {s.incomplete ? (
                      <span className="warn">{s.mine ? "Балиқ турларини тўлдиринг" : "Тўлиқ эмас, сиз тўлдиришингиз мумкин"}</span>
                    ) : !isComplete(s) ? (
                      <span className="warn">Балиқ турларини тўлдиринг</span>
                    ) : allFish(s).length > 0 ? (
                      <span className="fishLine">
                        {fish.map(
                          ([name, n]) =>
                            name &&
                            isFish(name) && (
                              <span key={name} className="fish">
                                {cyr(name)}
                                <Level n={n} />
                              </span>
                            )
                        )}
                      </span>
                    ) : (
                      <span className="rowMeta">Бу жойда балиқ йўқ</span>
                    )}
                    <span className="rowMeta">
                      {s.region && <span className="regionTag">{cyr(regionShort(s.region))}</span>}
                      {cyr(s.times.join(", "))}
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
        selected &&
        (selected.mine || selected.incomplete ? (
          <SpotSheet
            key={selected.id}
            spot={selected}
            onClose={() => setSelectedId(null)}
            onSaved={(u) => {
              if (selected.incomplete && !u.incomplete && !u.mine) toast("Rahmat! Joy to'ldirildi. Endi uni faqat egasi o'zgartira oladi.");
              onSaved(u);
            }}
            onDeleted={onDeleted}
            toast={toast}
          />
        ) : (
          <ViewSheet
            key={selected.id}
            spot={selected}
            onClose={() => setSelectedId(null)}
            toast={toast}
          />
        ))
      )}

      {message && <div className="toast">{message}</div>}
    </div>
  );
}
