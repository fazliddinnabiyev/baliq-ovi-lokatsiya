import { OTHER_REGION, nearestRegion } from "./regions";

// ISO 3166-2:UZ kodlari -> viloyat nomi
const ISO: Record<string, string> = {
  "UZ-TK": "Toshkent shahri",
  "UZ-TO": "Toshkent viloyati",
  "UZ-AN": "Andijon viloyati",
  "UZ-NG": "Namangan viloyati",
  "UZ-FA": "Farg'ona viloyati",
  "UZ-SA": "Samarqand viloyati",
  "UZ-JI": "Jizzax viloyati",
  "UZ-SI": "Sirdaryo viloyati",
  "UZ-BU": "Buxoro viloyati",
  "UZ-NW": "Navoiy viloyati",
  "UZ-QA": "Qashqadaryo viloyati",
  "UZ-SU": "Surxondaryo viloyati",
  "UZ-XO": "Xorazm viloyati",
  "UZ-QR": "Qoraqalpog'iston Respublikasi",
};

const NAMES: [RegExp, string][] = [
  [/karakalpak|qoraqalpo/, "Qoraqalpog'iston Respublikasi"],
  [/andij/, "Andijon viloyati"],
  [/namang/, "Namangan viloyati"],
  [/fergana|ferghana|farg/, "Farg'ona viloyati"],
  [/samarkand|samarqand/, "Samarqand viloyati"],
  [/bukhara|bukhoro|buxoro/, "Buxoro viloyati"],
  [/navoi|navoiy/, "Navoiy viloyati"],
  [/kashkadar|qashqadar|kashkadarya/, "Qashqadaryo viloyati"],
  [/surkhandar|surxondar|surkhondar/, "Surxondaryo viloyati"],
  [/jizzak|dzhizak/, "Jizzax viloyati"],
  [/syrdar|sirdar/, "Sirdaryo viloyati"],
  [/khorezm|xorazm|khorazm|khwarezm/, "Xorazm viloyati"],
];

function fromName(state: string): string | null {
  const s = state.toLowerCase();
  for (const [re, name] of NAMES) if (re.test(s)) return name;
  if (/tashkent|toshkent/.test(s)) {
    return /region|viloyat|oblast/.test(s) ? "Toshkent viloyati" : "Toshkent shahri";
  }
  return null;
}

/**
 * Lokatsiyadan viloyatni aniqlaydi: avval OpenStreetMap (Nominatim),
 * ishlamasa eng yaqin shahar bo'yicha taxminiy.
 */
export async function detectRegion(lat: number, lng: number): Promise<string> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=5&addressdetails=1&accept-language=en&lat=${lat}&lon=${lng}`,
      { headers: { "User-Agent": "baliq-ovi-lokatsiya/1.0 (personal fishing journal)" }, signal: ctrl.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { address?: Record<string, string> };
      const a = data.address;
      if (a) {
        if (a.country_code && a.country_code.toLowerCase() !== "uz") return OTHER_REGION;
        const iso = a["ISO3166-2-lvl4"] || a["ISO3166-2-lvl3"];
        if (iso && ISO[iso]) return ISO[iso];
        const byName = fromName(a.state || a.region || a.city || "");
        if (byName) return byName;
      }
    }
  } catch {
    /* tarmoq xatosi: taxminiy usulga o'tamiz */
  }
  return nearestRegion(lat, lng);
}
