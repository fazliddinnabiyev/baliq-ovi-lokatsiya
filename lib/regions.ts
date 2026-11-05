export const REGIONS = [
  "Toshkent shahri",
  "Toshkent viloyati",
  "Andijon viloyati",
  "Namangan viloyati",
  "Farg'ona viloyati",
  "Samarqand viloyati",
  "Jizzax viloyati",
  "Sirdaryo viloyati",
  "Buxoro viloyati",
  "Navoiy viloyati",
  "Qashqadaryo viloyati",
  "Surxondaryo viloyati",
  "Xorazm viloyati",
  "Qoraqalpog'iston Respublikasi",
] as const;

export const OTHER_REGION = "Boshqa hudud";

export function isRegion(v: unknown): v is string {
  return typeof v === "string" && (v === OTHER_REGION || (REGIONS as readonly string[]).includes(v));
}

/** Filtr tugmalari va ro'yxat uchun qisqa nom. */
export function regionShort(name: string | null | undefined): string {
  if (!name) return "";
  if (name.startsWith("Toshkent")) return name;
  if (name.startsWith("Qoraqalpog")) return "Qoraqalpog'iston";
  return name.replace(/ viloyati$/, "");
}

// Internet ishlamaganda taxminiy aniqlash uchun: har viloyatdagi asosiy shaharlar (lat, lng).
const ANCHORS: Record<(typeof REGIONS)[number], [number, number][]> = {
  "Toshkent shahri": [[41.31, 69.28]],
  "Toshkent viloyati": [[41.04, 69.36], [41.47, 69.58], [41.02, 70.14], [40.85, 69.6], [41.55, 69.77], [40.9, 68.9]],
  "Andijon viloyati": [[40.78, 72.34], [40.64, 72.24], [40.82, 72.85], [40.74, 71.95]],
  "Namangan viloyati": [[41.0, 71.67], [41.0, 71.23], [40.87, 71.1], [41.4, 71.7]],
  "Farg'ona viloyati": [[40.38, 71.78], [40.52, 70.94], [40.47, 71.72], [40.3, 71.0]],
  "Samarqand viloyati": [[39.65, 66.96], [39.9, 66.27], [39.4, 67.25], [39.7, 67.1], [40.1, 66.2]],
  "Jizzax viloyati": [[40.12, 67.84], [39.96, 68.4], [40.5, 66.7], [40.1, 67.3]],
  "Sirdaryo viloyati": [[40.48, 68.78], [40.27, 68.82], [40.85, 68.67]],
  "Buxoro viloyati": [[39.77, 64.42], [39.72, 64.55], [40.1, 64.68], [39.5, 63.85], [39.4, 63.8], [40.6, 63.5]],
  "Navoiy viloyati": [[40.1, 65.37], [41.57, 64.2], [42.15, 63.5], [40.3, 65.15], [40.4, 66.0]],
  "Qashqadaryo viloyati": [[38.86, 65.79], [39.06, 66.83], [39.25, 65.15], [38.4, 66.0], [38.2, 65.7]],
  "Surxondaryo viloyati": [[37.22, 67.28], [38.27, 67.9], [37.67, 67.0], [38.0, 67.7]],
  "Xorazm viloyati": [[41.55, 60.63], [41.38, 60.36], [41.65, 60.3]],
  "Qoraqalpog'iston Respublikasi": [[42.46, 59.6], [43.77, 59.02], [42.93, 59.77], [41.69, 60.75], [43.07, 58.9], [42.4, 61.0]],
};

function distKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const x = (bLng - aLng) * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  const y = bLat - aLat;
  return Math.sqrt(x * x + y * y) * 111;
}

/** Eng yaqin shahar bo'yicha taxminiy viloyat (chegaralarda adashishi mumkin). */
export function nearestRegion(lat: number, lng: number): string {
  let best: string = OTHER_REGION;
  let bestD = Infinity;
  for (const region of REGIONS) {
    for (const [la, ln] of ANCHORS[region]) {
      const d = distKm(lat, lng, la, ln);
      if (d < bestD) {
        bestD = d;
        best = region;
      }
    }
  }
  return bestD > 320 ? OTHER_REGION : best;
}
