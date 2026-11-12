import type { TgUser } from "./auth";
import { displayName } from "./auth";
import { query } from "./db";

/** Foydalanuvchi faolligini yozadi (faqat boshqaruvchi statistikasi uchun, hech kimga ko'rinmaydi). */
export async function trackUser(u: TgUser, started: boolean): Promise<void> {
  const id = String(u.id);
  await query(
    `INSERT INTO app_users (id, username, first_name, opens, started)
     VALUES ($1, $2, $3, 1, $4)
     ON CONFLICT (id) DO UPDATE SET
       username = EXCLUDED.username, first_name = EXCLUDED.first_name,
       last_seen = now(), opens = app_users.opens + 1,
       started = app_users.started OR EXCLUDED.started`,
    [id, u.username || "", displayName(u), started]
  );
  await query(
    `INSERT INTO app_activity (user_id, day) VALUES ($1, (now() AT TIME ZONE 'Asia/Tashkent')::date) ON CONFLICT DO NOTHING`,
    [id]
  );
}

const one = async (sql: string) => Number((await query<{ n: string }>(sql)).rows[0]?.n ?? 0);

export async function collectStats() {
  const D = "(now() AT TIME ZONE 'Asia/Tashkent')::date";
  const [users, new1, new7, act1, act7, act30, started] = await Promise.all([
    one(`SELECT COUNT(*) n FROM app_users`),
    one(`SELECT COUNT(*) n FROM app_users WHERE (first_seen AT TIME ZONE 'Asia/Tashkent')::date = ${D}`),
    one(`SELECT COUNT(*) n FROM app_users WHERE first_seen > now() - interval '7 days'`),
    one(`SELECT COUNT(DISTINCT user_id) n FROM app_activity WHERE day = ${D}`),
    one(`SELECT COUNT(DISTINCT user_id) n FROM app_activity WHERE day > ${D} - 7`),
    one(`SELECT COUNT(DISTINCT user_id) n FROM app_activity WHERE day > ${D} - 30`),
    one(`SELECT COUNT(*) n FROM app_users WHERE started`),
  ]);
  const [spots, complete, incomplete, spots7, comments, comments7, photos, videos, owners] = await Promise.all([
    one(`SELECT COUNT(*) n FROM spots`),
    one(`SELECT COUNT(*) n FROM spots WHERE NOT incomplete`),
    one(`SELECT COUNT(*) n FROM spots WHERE incomplete`),
    one(`SELECT COUNT(*) n FROM spots WHERE created_at > now() - interval '7 days'`),
    one(`SELECT COUNT(*) n FROM spot_comments`),
    one(`SELECT COUNT(*) n FROM spot_comments WHERE created_at > now() - interval '7 days'`),
    one(`SELECT COUNT(*) n FROM spot_media WHERE kind <> 'video'`),
    one(`SELECT COUNT(*) n FROM spot_media WHERE kind = 'video'`),
    one(`SELECT COUNT(DISTINCT owner_id) n FROM spots`),
  ]);
  const byRegion = (await query<{ k: string; n: string }>(
    `SELECT COALESCE(region,'Номаълум') k, COUNT(*) n FROM spots GROUP BY 1 ORDER BY 2 DESC LIMIT 20`)).rows;
  const byFish = (await query<{ k: string; n: string }>(
    `SELECT fish_most k, COUNT(*) n FROM spots WHERE fish_most IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`)).rows;
  const top = (await query<{ name: string; username: string; spots: string; comments: string }>(
    `SELECT COALESCE(NULLIF(u.first_name,''), s.owner_id) name, COALESCE(u.username,'') username, COUNT(*) spots,
       (SELECT COUNT(*) FROM spot_comments c WHERE c.user_id = s.owner_id) comments
     FROM spots s LEFT JOIN app_users u ON u.id = s.owner_id GROUP BY s.owner_id, u.first_name, u.username
     ORDER BY 3 DESC LIMIT 10`)).rows;
  const recent = (await query<{ name: string; username: string; first_seen: string; last_seen: string; opens: number }>(
    `SELECT COALESCE(NULLIF(first_name,''), id) name, username, first_seen, last_seen, opens FROM app_users ORDER BY last_seen DESC LIMIT 15`)).rows;
  const daily = (await query<{ day: string; active: string; fresh: string; spots: string }>(
    `SELECT to_char(d, 'DD.MM') day,
       (SELECT COUNT(*) FROM app_activity a WHERE a.day = d) active,
       (SELECT COUNT(*) FROM app_users u WHERE (u.first_seen AT TIME ZONE 'Asia/Tashkent')::date = d) fresh,
       (SELECT COUNT(*) FROM spots s WHERE (s.created_at AT TIME ZONE 'Asia/Tashkent')::date = d) spots
     FROM generate_series(${D} - 13, ${D}, interval '1 day') d ORDER BY d`)).rows;
  return {
    users: { total: users, started, new1, new7, act1, act7, act30 },
    spots: { total: spots, complete, incomplete, last7: spots7, owners },
    comments: { total: comments, last7: comments7 },
    media: { photos, videos },
    byRegion: byRegion.map((r) => ({ k: r.k, n: Number(r.n) })),
    byFish: byFish.map((r) => ({ k: r.k, n: Number(r.n) })),
    top: top.map((r) => ({ ...r, spots: Number(r.spots), comments: Number(r.comments) })),
    recent,
    daily: daily.map((r) => ({ day: r.day, active: Number(r.active), fresh: Number(r.fresh), spots: Number(r.spots) })),
  };
}
