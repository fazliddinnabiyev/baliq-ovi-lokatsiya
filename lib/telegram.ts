export async function tgCall(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

let cachedUsername: string | null = null;

/** Botning @username'i (ulashish havolasi uchun). */
export async function botUsername(): Promise<string> {
  if (cachedUsername) return cachedUsername;
  const r = await tgCall("getMe", {});
  const u = r?.result?.username;
  if (!u) throw new Error("Bot nomi aniqlanmadi");
  cachedUsername = u;
  return u;
}
