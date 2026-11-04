import crypto from "crypto";

/**
 * Telegram webhook maxfiy kaliti. WEBHOOK_SECRET berilgan bo'lsa shuni ishlatadi,
 * aks holda BOT_TOKEN'dan avtomatik hosil qiladi (harf va raqamlardan iborat).
 */
export function webhookSecret(): string | null {
  if (process.env.WEBHOOK_SECRET) return process.env.WEBHOOK_SECRET;
  const token = process.env.BOT_TOKEN;
  if (!token) return null;
  return crypto.createHash("sha256").update(`baliq-webhook:${token}`).digest("hex");
}
