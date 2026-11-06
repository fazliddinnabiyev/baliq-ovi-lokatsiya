import { query } from "./db";
import { isFishOrNone } from "./fish";
import { nearestRegion } from "./regions";
import type { Spot } from "./types";

const SPOT_SELECT = `
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

export async function listSpots(ownerId: string): Promise<Spot[]> {
  const r = await query<Spot>(
    `SELECT ${SPOT_SELECT} FROM spots s WHERE s.owner_id = $1 AND s.draft = false ORDER BY s.id DESC`,
    [ownerId]
  );
  return tidy(r.rows);
}

/** includeDraft: bot hali tugallanmagan (baliq tanlanayotgan) joyni ham ko'rishi uchun. */
export async function getSpot(id: number, ownerId: string, includeDraft = false): Promise<Spot | null> {
  if (!Number.isInteger(id)) return null;
  const r = await query<Spot>(
    `SELECT ${SPOT_SELECT} FROM spots s
     WHERE s.id = $1 AND s.owner_id = $2 AND ($3::boolean OR s.draft = false)`,
    [id, ownerId, includeDraft]
  );
  const rows = await tidy(r.rows);
  return rows[0] ?? null;
}

/** Ulashilgan havola (token) bo'yicha joy; faqat ko'rish uchun. */
export async function getSpotByToken(token: string): Promise<Spot | null> {
  if (!/^[a-f0-9]{16}$/.test(token)) return null;
  const r = await query<Spot>(
    `SELECT ${SPOT_SELECT} FROM spots s WHERE s.share_token = $1 AND s.draft = false`,
    [token]
  );
  const rows = await tidy(r.rows);
  return rows[0] ?? null;
}
