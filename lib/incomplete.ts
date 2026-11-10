import { displayName, type TgUser } from "./auth";
import { query } from "./db";
import { detectRegion } from "./geocode";
import { tgCall } from "./telegram";

/** Botga yuborilgan lokatsiya: to'liq bo'lmagan joy sifatida darrov xaritaga qo'shiladi. */
export async function createIncompleteSpot(user: TgUser, lat: number, lng: number): Promise<number> {
  const region = await detectRegion(lat, lng);
  const r = await query<{ id: number }>(
    `INSERT INTO spots (owner_id, owner_name, lat, lng, region, incomplete) VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
    [String(user.id), displayName(user), lat, lng, region]
  );
  return r.rows[0].id;
}

/**
 * Egasiga BIR MARTA ogohlantirish: lokatsiyangiz to'liq emas. Har bir joy uchun ko'pi bilan bir marta.
 * minAgeMinutes: joy kamida shuncha vaqtdan beri to'liq emas bo'lsa (0 = darrov).
 */
export async function warnOwner(ownerId: string, base: string, minAgeMinutes = 0): Promise<number> {
  const r = await query<{ id: number }>(
    `UPDATE spots SET warned = true
     WHERE owner_id = $1 AND incomplete = true AND warned = false
       AND created_at < now() - ($2::int * interval '1 minute')
     RETURNING id`,
    [ownerId, minAgeMinutes]
  );
  if (!r.rows.length) return 0;
  const id = r.rows[r.rows.length - 1].id;
  const many = r.rows.length > 1;
  await tgCall("sendMessage", {
    chat_id: Number(ownerId),
    text:
      `⚠️ ${many ? `${r.rows.length} та локациянгиз` : "Локациянгиз"} тўлиқ эмас: балиқ турлари киритилмаган.\n` +
      `${many ? "Улар" : "U"} харитада бошқача рангда кўринади ва бошқалар ҳам тўлдириши мумкин. ` +
      "Сиз тўлдирсангиз яхши бўлади.",
    reply_markup: { inline_keyboard: [[{ text: "🎣 Тўлдириш", web_app: { url: `${base}/?spot=${id}` } }]] },
  });
  return r.rows.length;
}

let lastRun = 0;

/** Zaxira: signal kelmagan bo'lsa, 30 daqiqadan keyin bir marta ogohlantiradi (bot/ilova so'rovlari bilan ishga tushadi). */
export async function warnStale(base: string): Promise<void> {
  const now = Date.now();
  if (now - lastRun < 60_000) return;
  lastRun = now;
  const r = await query<{ owner_id: string }>(
    `SELECT DISTINCT owner_id FROM spots
     WHERE incomplete = true AND warned = false AND created_at < now() - interval '30 minutes' LIMIT 20`
  );
  for (const row of r.rows) {
    try {
      await warnOwner(row.owner_id, base, 30);
    } catch (e) {
      console.error("Огоҳлантириш юборилмади", e);
    }
  }
}
