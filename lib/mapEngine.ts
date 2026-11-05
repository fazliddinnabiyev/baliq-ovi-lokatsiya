/* eslint-disable @typescript-eslint/no-explicit-any */
import type * as LeafletTypes from "leaflet";

/** [janubi-g'arb (lat, lng), shimoli-sharq (lat, lng)] */
export type Bounds = [[number, number], [number, number]];

export type Pin = { id: number; lat: number; lng: number; color: string };

export type Handlers = {
  onPinClick: (id: number) => void;
  onMapClick: (lat: number, lng: number) => void;
  dark: boolean;
};

/** Ikkala xarita (Yandex va Leaflet) bir xil usulda boshqariladi. */
export type MapEngine = {
  fit: (b: Bounds, animate?: boolean, maxZoom?: number) => void;
  /** Joyga uchadi; kattalashtirish hozirgisidan kam bo'lmaydi, kamida minZoom. */
  focus: (lat: number, lng: number, minZoom: number) => void;
  pan: (lat: number, lng: number) => void;
  zoom: () => number;
  setPins: (pins: Pin[], selectedId: number | null) => void;
  setTemp: (p: { lat: number; lng: number } | null) => void;
  resize: () => void;
  destroy: () => void;
};

const START_CENTER: [number, number] = [41.3, 69.27];
const TEMP_COLOR = "#e4473a";

function pinHtml(color: string, selected: boolean): string {
  return `<div class="pinW ${selected ? "pinSel" : ""}"><i class="pin" style="--c:${color}"></i></div>`;
}

/* ------------------------------ Yandex Maps ------------------------------ */

let ymapsPromise: Promise<any> | null = null;

function loadYmaps(key: string): Promise<any> {
  if (ymapsPromise) return ymapsPromise;
  ymapsPromise = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.ymaps) {
      w.ymaps.ready(() => resolve(w.ymaps));
      return;
    }
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
    s.async = true;
    s.onload = () => (w.ymaps ? w.ymaps.ready(() => resolve(w.ymaps)) : reject(new Error("Yandex Maps topilmadi")));
    s.onerror = () => {
      ymapsPromise = null;
      reject(new Error("Yandex Maps yuklanmadi"));
    };
    document.head.appendChild(s);
  });
  return ymapsPromise;
}

export async function createYandexEngine(el: HTMLElement, key: string, h: Handlers): Promise<MapEngine> {
  const ymaps = await loadYmaps(key);
  const map = new ymaps.Map(
    el,
    { center: START_CENTER, zoom: 6, controls: ["typeSelector"] },
    { suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true }
  );

  const layouts = new Map<string, any>();
  const layoutFor = (color: string, selected: boolean) => {
    const k = `${color}${selected ? 1 : 0}`;
    let layout = layouts.get(k);
    if (!layout) {
      layout = ymaps.templateLayoutFactory.createClass(pinHtml(color, selected), {
        getShape() {
          return new ymaps.shape.Rectangle(new ymaps.geometry.pixel.Rectangle([[0, 0], [26, 30]]));
        },
      });
      layouts.set(k, layout);
    }
    return layout;
  };

  const placemark = (lat: number, lng: number, color: string, selected: boolean) =>
    new ymaps.Placemark(
      [lat, lng],
      {},
      {
        iconLayout: layoutFor(color, selected),
        iconOffset: [-13, -27],
        zIndex: selected ? 1000 : 100,
        hasBalloon: false,
        hasHint: false,
        cursor: "pointer",
      }
    );

  const pins = new Map<number, { pm: any; color: string; sel: boolean }>();
  let temp: any = null;

  map.events.add("click", (e: any) => {
    const [lat, lng] = e.get("coords");
    h.onMapClick(lat, lng);
  });

  return {
    fit(b, animate = true, maxZoom) {
      map
        .setBounds(b, { checkZoomRange: true, zoomMargin: 30, duration: animate ? 300 : 0 })
        .then(() => {
          if (maxZoom && map.getZoom() > maxZoom) map.setZoom(maxZoom);
        });
    },
    focus(lat, lng, minZoom) {
      map.setCenter([lat, lng], Math.max(map.getZoom(), minZoom), { duration: 300 });
    },
    pan(lat, lng) {
      map.panTo([lat, lng], { duration: 300 });
    },
    zoom: () => map.getZoom(),
    setPins(list, selectedId) {
      const seen = new Set<number>();
      for (const p of list) {
        seen.add(p.id);
        const sel = p.id === selectedId;
        const cur = pins.get(p.id);
        if (!cur) {
          const pm = placemark(p.lat, p.lng, p.color, sel);
          pm.events.add("click", () => h.onPinClick(p.id));
          map.geoObjects.add(pm);
          pins.set(p.id, { pm, color: p.color, sel });
        } else {
          cur.pm.geometry.setCoordinates([p.lat, p.lng]);
          if (cur.color !== p.color || cur.sel !== sel) {
            cur.pm.options.set({ iconLayout: layoutFor(p.color, sel), zIndex: sel ? 1000 : 100 });
            cur.color = p.color;
            cur.sel = sel;
          }
        }
      }
      pins.forEach((v, id) => {
        if (!seen.has(id)) {
          map.geoObjects.remove(v.pm);
          pins.delete(id);
        }
      });
    },
    setTemp(p) {
      if (temp) {
        map.geoObjects.remove(temp);
        temp = null;
      }
      if (p) {
        temp = placemark(p.lat, p.lng, TEMP_COLOR, true);
        map.geoObjects.add(temp);
      }
    },
    resize: () => map.container.fitToViewport(),
    destroy: () => map.destroy(),
  };
}

/* -------------------------- Leaflet (zaxira xarita) -------------------------- */

export async function createLeafletEngine(el: HTMLElement, h: Handlers): Promise<MapEngine> {
  const mod = await import("leaflet");
  const L = ((mod as unknown as { default?: typeof LeafletTypes }).default ?? mod) as typeof LeafletTypes;

  const map = L.map(el, { zoomControl: false, attributionControl: false }).setView(START_CENTER, 6);
  const base = L.tileLayer(
    `https://{s}.basemaps.cartocdn.com/${h.dark ? "dark_all" : "rastermaps/voyager"}/{z}/{x}/{y}{r}.png`,
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
  map.on("click", (e: LeafletTypes.LeafletMouseEvent) => h.onMapClick(e.latlng.lat, e.latlng.lng));

  const icon = (color: string, selected: boolean) =>
    L.divIcon({ className: "", html: pinHtml(color, selected), iconSize: [26, 30], iconAnchor: [13, 27] });

  const pins = new Map<number, { marker: LeafletTypes.Marker; color: string; sel: boolean }>();
  let temp: LeafletTypes.Marker | null = null;

  return {
    fit(b, animate = true, maxZoom) {
      map.fitBounds(b, { padding: [40, 40], maxZoom, animate });
    },
    focus(lat, lng, minZoom) {
      map.setView([lat, lng], Math.max(map.getZoom(), minZoom), { animate: true });
    },
    pan(lat, lng) {
      map.panTo([lat, lng], { animate: true });
    },
    zoom: () => map.getZoom(),
    setPins(list, selectedId) {
      const seen = new Set<number>();
      for (const p of list) {
        seen.add(p.id);
        const sel = p.id === selectedId;
        const cur = pins.get(p.id);
        if (!cur) {
          const marker = L.marker([p.lat, p.lng], { icon: icon(p.color, sel), zIndexOffset: sel ? 1000 : 0 }).addTo(map);
          marker.on("click", () => h.onPinClick(p.id));
          pins.set(p.id, { marker, color: p.color, sel });
        } else {
          cur.marker.setLatLng([p.lat, p.lng]);
          if (cur.color !== p.color || cur.sel !== sel) {
            cur.marker.setIcon(icon(p.color, sel));
            cur.marker.setZIndexOffset(sel ? 1000 : 0);
            cur.color = p.color;
            cur.sel = sel;
          }
        }
      }
      pins.forEach((v, id) => {
        if (!seen.has(id)) {
          v.marker.remove();
          pins.delete(id);
        }
      });
    },
    setTemp(p) {
      temp?.remove();
      temp = null;
      if (p) temp = L.marker([p.lat, p.lng], { icon: icon(TEMP_COLOR, true), zIndexOffset: 2000 }).addTo(map);
    },
    resize: () => map.invalidateSize(),
    destroy: () => map.remove(),
  };
}
