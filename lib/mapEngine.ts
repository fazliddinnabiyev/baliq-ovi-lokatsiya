import type * as LeafletTypes from "leaflet";

/** [janubi-g'arb (lat, lng), shimoli-sharq (lat, lng)] */
export type Bounds = [[number, number], [number, number]];

export type Pin = { id: number; lat: number; lng: number; color: string; incomplete?: boolean };

export type Handlers = {
  onPinClick: (id: number) => void;
  onMapClick: (lat: number, lng: number) => void;
  dark: boolean;
};

/** Xarita dvigateli: App shu interfeys orqali xaritani boshqaradi. */
export type MapEngine = {
  fit: (b: Bounds, animate?: boolean, maxZoom?: number) => void;
  /** Joyga uchadi; kattalashtirish hozirgisidan kam bo'lmaydi, kamida minZoom. */
  focus: (lat: number, lng: number, minZoom: number) => void;
  pan: (lat: number, lng: number) => void;
  zoom: () => number;
  setPins: (pins: Pin[], selectedId: number | null) => void;
  setTemp: (p: { lat: number; lng: number } | null) => void;
  /** Foydalanuvchining o'z joylashuvi (ko'k nuqta) */
  setMe: (p: { lat: number; lng: number; accuracy: number } | null) => void;
  resize: () => void;
  destroy: () => void;
};

const START_CENTER: [number, number] = [41.3, 69.27];
const TEMP_COLOR = "#e4473a";

function pinHtml(color: string, selected: boolean, incomplete = false): string {
  return `<div class="pinW ${selected ? "pinSel" : ""} ${incomplete ? "pinInc" : ""}"><i class="pin" style="--c:${color}"></i></div>`;
}

/* ------------------------------ Leaflet xarita ------------------------------ */

export async function createLeafletEngine(el: HTMLElement, h: Handlers): Promise<MapEngine> {
  const mod = await import("leaflet");
  const L = ((mod as unknown as { default?: typeof LeafletTypes }).default ?? mod) as typeof LeafletTypes;

  const map = L.map(el, { zoomControl: false, attributionControl: false }).setView(START_CENTER, 6);
  // Bepul va kalitsiz xaritalar. Tanlangan ko'rinish eslab qolinadi.
  const street = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "© Esri, HERE, Garmin, OpenStreetMap" }
  );
  const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  });
  const topo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 17,
    subdomains: "abc",
    attribution: "© OpenStreetMap, © OpenTopoMap",
  });
  const sat = L.layerGroup([
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "© Esri",
    }),
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 }
    ),
  ]);
  const bases: Record<string, LeafletTypes.Layer> = {
    "Харита": street,
    "Батафсил": osm,
    "Рельеф": topo,
    "Йўлдош": sat,
  };

  let saved = "";
  try {
    saved = localStorage.getItem("baliq-base") || "";
  } catch {
    /* saqlash mumkin emas */
  }
  (bases[saved] ?? street).addTo(map);

  L.control.layers(bases, undefined, { position: "topright" }).addTo(map);
  L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);
  map.on("baselayerchange", (e: LeafletTypes.LayersControlEvent) => {
    try {
      localStorage.setItem("baliq-base", e.name);
    } catch {
      /* ixtiyoriy */
    }
  });
  map.on("click", (e: LeafletTypes.LeafletMouseEvent) => h.onMapClick(e.latlng.lat, e.latlng.lng));

  const icon = (color: string, selected: boolean, incomplete = false) =>
    L.divIcon({ className: "", html: pinHtml(color, selected, incomplete), iconSize: [26, 30], iconAnchor: [13, 27] });

  const pins = new Map<number, { marker: LeafletTypes.Marker; color: string; sel: boolean; inc: boolean }>();
  let temp: LeafletTypes.Marker | null = null;
  let me: { dot: LeafletTypes.Marker; ring: LeafletTypes.Circle } | null = null;

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
          const marker = L.marker([p.lat, p.lng], { icon: icon(p.color, sel, !!p.incomplete), zIndexOffset: sel ? 1000 : 0 }).addTo(map);
          marker.on("click", () => h.onPinClick(p.id));
          pins.set(p.id, { marker, color: p.color, sel, inc: !!p.incomplete });
        } else {
          cur.marker.setLatLng([p.lat, p.lng]);
          if (cur.color !== p.color || cur.sel !== sel || cur.inc !== !!p.incomplete) {
            cur.marker.setIcon(icon(p.color, sel, !!p.incomplete));
            cur.inc = !!p.incomplete;
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
    setMe(p) {
      if (!p) {
        me?.dot.remove();
        me?.ring.remove();
        me = null;
        return;
      }
      if (!me) {
        const ring = L.circle([p.lat, p.lng], {
          radius: p.accuracy,
          stroke: false,
          fillColor: "#2f80c9",
          fillOpacity: 0.15,
          interactive: false,
        }).addTo(map);
        const dot = L.marker([p.lat, p.lng], {
          icon: L.divIcon({ className: "", html: '<div class="meDot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
          zIndexOffset: 3000,
          interactive: false,
        }).addTo(map);
        me = { dot, ring };
      } else {
        me.dot.setLatLng([p.lat, p.lng]);
        me.ring.setLatLng([p.lat, p.lng]);
        me.ring.setRadius(p.accuracy);
      }
    },
    resize: () => map.invalidateSize(),
    destroy: () => map.remove(),
  };
}
