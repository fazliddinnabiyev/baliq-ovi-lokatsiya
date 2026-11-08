import { query } from "./db";
import { tgCall } from "./telegram";

export type Pending = { lat: number; lng: number };

/** Botga yuborilgan, lekin hali saqlanmagan lokatsiya (har foydalanuvchida bittadan). */
export async function savePending(userId: string, chatId: number, lat: number, lng: number) {
  await query(
    `INSERT INTO pending_spots (owner_id, chat_id, lat, lng) VALUES ($1, $2, $3, $4)
     ON CONFLICT (owner_id) DO UPDATE
       SET chat_id = $2, lat = $3, lng = $4, created_at = now(), reminded_at = NULL, remind_count = 0`,
    [userId, chatId, lat, lng]
  );
}

export async function getPending(userId: string): Promise<Pending | null> {
  const r = await query<Pending>(`SELECT lat, lng FROM pending_spots WHERE owner_id = $1`, [userId]);
  return r.rows[0] ?? null;
}

export async function clearPending(userId: string) {
  await query(`DELETE FROM pending_spots WHERE owner_id = $1`, [userId]);
}

export function pendingButton(base: string) {
  return { inline_keyboard: [[{ text: "🎣 Yakunlash", web_app: { url: `${base}/` } }]] };
}

export const PENDING_TEXT =
  "⏳ Lokatsiyangiz hali saqlanmadi.\nIlovani ochsangiz, shu joy sizni kutib turadi: baliq turlarini tanlab saqlang yoki joyni o'chirib tashlang.";

let lastRun = 0;

/**
 * Yakunlanmagan joyi bor foydalanuvchilarga eslatma yuboradi:
 * 30 daqiqadan keyin, keyin har 6 soatda (ko'pi bilan 3 marta), faqat 08:00–22:00 (Toshkent).
 * Cron kuniga bir marta, qolgan paytlarda bot/ilova so'rovlari bilan ishga tushadi.
 */
export async function remindStale(base: string, force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastRun < 60_000) return 0;
  lastRun = now;

  const r = await query<{ owner_id: string; chat_id: string }>(
    `UPDATE pending_spots SET reminded_at = now(), remind_count = remind_count + 1
     WHERE owner_id IN (
       SELECT owner_id FROM pending_spots
       WHERE created_at < now() - interval '30 minutes'
         AND (reminded_at IS NULL OR reminded_at < now() - interval '6 hours')
         AND remind_count < 3
         AND extract(hour FROM (now() AT TIME ZONE 'Asia/Tashkent')) BETWEEN 8 AND 21
       LIMIT 20
     )
     RETURNING owner_id, chat_id`
  );
  for (const row of r.rows) {
    try {
      await tgCall("sendMessage", { chat_id: Number(row.chat_id), text: PENDING_TEXT, reply_markup: pendingButton(base) });
    } catch (e) {
      console.error("Eslatma yuborilmadi", e);
    }
  }
  return r.rows.length;
}
