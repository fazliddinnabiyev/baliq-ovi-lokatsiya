export const FISH = ["Sazan", "Laqqa", "Mayda baliq", "Ilonbosh"] as const;

export const TIMES = ["Tong", "Ertalab", "Tush payti", "Kechqurun", "Tun"] as const;

/** Xaritadagi belgi rangi eng ko'p uchraydigan baliq turiga qarab tanlanadi. */
export const FISH_COLORS: Record<string, string> = {
  Sazan: "#e8803a",
  Laqqa: "#2f80c9",
  "Mayda baliq": "#5aa845",
  Ilonbosh: "#8b5fb0",
};
export const DEFAULT_PIN_COLOR = "#6b7f84";

/** "Yo'q": bu darajada baliq deyarli uchramaydi. Bir necha darajada takrorlanishi mumkin. */
export const NONE = "Yo'q";

export function isFish(v: unknown): v is (typeof FISH)[number] {
  return typeof v === "string" && (FISH as readonly string[]).includes(v);
}

export function isFishOrNone(v: unknown): v is string {
  return v === NONE || isFish(v);
}

/**
 * Eng ko'p, o'rtacha va eng kam: har biri baliq turi yoki "Yo'q" bo'lishi shart (bo'sh qoldirib bo'lmaydi).
 * Haqiqiy baliq turlari bir-biridan farqli bo'lishi kerak, "Yo'q" esa takrorlanishi mumkin.
 */
export function validRanking(a: unknown, b: unknown, c: unknown): boolean {
  if (!isFishOrNone(a) || !isFishOrNone(b) || !isFishOrNone(c)) return false;
  const real = [a, b, c].filter(isFish);
  return new Set(real).size === real.length;
}
