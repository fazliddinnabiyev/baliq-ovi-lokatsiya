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

export function isFish(v: unknown): v is (typeof FISH)[number] {
  return typeof v === "string" && (FISH as readonly string[]).includes(v);
}

/** Eng ko'p, o'rtacha va eng kam baliq: uchalasi tanlangan va bir-biridan farqli bo'lishi shart. */
export function validRanking(a: unknown, b: unknown, c: unknown): boolean {
  return isFish(a) && isFish(b) && isFish(c) && a !== b && a !== c && b !== c;
}
