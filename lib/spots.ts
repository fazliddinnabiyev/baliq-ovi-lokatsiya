import { query } from "./db";
import { isFishOrNone } from "./fish";
import { nearestRegion } from "./regions";
import type { Spot } from "./types";

/** viewer: so'rovdagi foydalanuvchi ID'sining parametr raqami (masalan "$1"). */
const spotSelect = (viewer: string) => `
  s.id,
  s.lat,
  s.lng,
  s.name,
  s.region,
  s.fish_most AS "fishMost",
  s.fish_mid AS "fishMid",
  s.fish_least AS "fishLeast",
  s.bait,
  s.times,
  s.note,
  s.created_at AS "createdAt",
  s.updated_at AS "updatedAt",
  s.owner_name AS "ownerName",
  s.incomplete,
  (s.owner_id = ${viewer}) AS mine,
  (SELECT count(*)::int FROM spot_comments c WHERE c.spot_id = s.id) AS "commentCount",
  COALESCE(
    (SELECT json_agg(json_build_object('id', m.id, 'url', m.url, 'kind', m.kind) ORDER BY m.id)
     FROM spot_media m WHERE m.spot_id = s.id),
    '[]'::json
  ) AS media
`;

/** Eski ma'lumotlarni tuzatadi: noma'lum baliq nomi bo'sh bo'ladi, viloyati yo'q joyga viloyat yoziladi. */
async function tidy(rows: Spot[]): Promise<Spot[]> {
  for (const r of rows) {
    if (!isFishOrNone(r.fishMost)) r.fishMost = null;
    if (!isFishOrNone(r.fishMid)) r.fishMid = null;
    if (!isFishOrNone(r.fishLeast)) r.fishLeast = null;
    if (!r.region) {
      r.region = nearestRegion(r.lat, r.lng);
      await query(`UPDATE spots SET region = $1 WHERE id = $2`, [r.region, r.id]);
    }
  }
  return rows;
}

/** Barcha foydalanuvchilarning joylari (ommaviy xarita). */
export async function listSpots(viewerId: string): Promise<Spot[]> {
  const r = await query<Spot>(
    `SELECT ${spotSelect("$1")} FROM spots s WHERE s.draft = false ORDER BY s.id DESC`,
    [viewerId]
  );
  return tidy(r.rows);
}

/** Istalgan joyni ko'rish (hamma uchun ochiq). */
export async function getSpotPublic(id: number, viewerId: string): Promise<Spot | null> {
  if (!Number.isInteger(id)) return null;
  const r = await query<Spot>(`SELECT ${spotSelect("$2")} FROM spots s WHERE s.id = $1 AND s.draft = false`, [id, viewerId]);
  const rows = await tidy(r.rows);
  return rows[0] ?? null;
}

/** Faqat egasi uchun: o'zgartirish, o'chirish, fayl qo'shish shu orqali tekshiriladi. */
export async function getSpot(id: number, ownerId: string, includeDraft = false): Promise<Spot | null> {
  if (!Number.isInteger(id)) return null;
  const r = await query<Spot>(
    `SELECT ${spotSelect("$2")} FROM spots s
     WHERE s.id = $1 AND s.owner_id = $2 AND ($3::boolean OR s.draft = false)`,
    [id, ownerId, includeDraft]
  );
  const rows = await tidy(r.rows);
  return rows[0] ?? null;
}

/** Ulashilgan havola (token) bo'yicha joy. */
export async function getSpotByToken(token: string, viewerId = ""): Promise<Spot | null> {
  if (!/^[a-f0-9]{16}$/.test(token)) return null;
  const r = await query<Spot>(
    `SELECT ${spotSelect("$2")} FROM spots s WHERE s.share_token = $1 AND s.draft = false`,
    [token, viewerId]
  );
  const rows = await tidy(r.rows);
  return rows[0] ?? null;
}

/** Tahrirlash mumkin bo'lgan joy: egasi har doim, to'liq bo'lmagan joyni esa hamma to'ldira oladi. */
export async function getSpotEditable(id: number, userId: string): Promise<Spot | null> {
  const s = await getSpotPublic(id, userId);
  return s && (s.mine || s.incomplete) ? s : null;
}
