import { query } from "./db";
import type { Spot } from "./types";

const SPOT_SELECT = `
  s.id,
  s.lat,
  s.lng,
  s.name,
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

export async function listSpots(ownerId: string): Promise<Spot[]> {
  const r = await query<Spot>(
    `SELECT ${SPOT_SELECT} FROM spots s WHERE s.owner_id = $1 ORDER BY s.id DESC`,
    [ownerId]
  );
  return r.rows;
}

export async function getSpot(id: number, ownerId: string): Promise<Spot | null> {
  if (!Number.isInteger(id)) return null;
  const r = await query<Spot>(
    `SELECT ${SPOT_SELECT} FROM spots s WHERE s.id = $1 AND s.owner_id = $2`,
    [id, ownerId]
  );
  return r.rows[0] ?? null;
}
