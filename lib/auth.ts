import crypto from "crypto";

export type TgUser = { id: number; first_name?: string; username?: string };

/** Telegram Mini App initData imzosini tekshiradi. */
export function verifyInitData(initData: string): TgUser | null {
  const token = process.env.BOT_TOKEN;
  if (!token || !initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const calc = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");

  const a = Buffer.from(calc);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Date.now() / 1000 - authDate > 7 * 24 * 3600) return null;

  try {
    const user = JSON.parse(params.get("user") || "");
    if (typeof user?.id !== "number") return null;
    return user as TgUser;
  } catch {
    return null;
  }
}

export function isAllowed(userId: number): boolean {
  const list = (process.env.ALLOWED_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length === 0 || list.includes(String(userId));
}

export function requireUser(req: Request): TgUser | null {
  const user = verifyInitData(req.headers.get("x-telegram-init-data") || "");
  return user && isAllowed(user.id) ? user : null;
}
