import { NextResponse } from "next/server";
import { displayName, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { TIMES, validRanking } from "@/lib/fish";
import { detectRegion } from "@/lib/geocode";
import { badRequest, fail, unauthorized } from "@/lib/http";
import { isRegion } from "@/lib/regions";
import { appUrl } from "@/lib/http";
import { warnStale } from "@/lib/incomplete";
import { getSpot, listSpots } from "@/lib/spots";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();
    // Eski joylarga egasining ismini yozib qo'yamiz (komment va ro'yxatda ko'rinishi uchun).
    await query(`UPDATE spots SET owner_name = $1 WHERE owner_id = $2 AND owner_name = ''`, [displayName(user), String(user.id)]);
    warnStale(appUrl(req)).catch(() => {});
    return NextResponse.json(await listSpots(String(user.id)));
  } catch (e) {
    return fail(e);
  }
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();

    const body = (await req.json()) as Record<string, unknown>;
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return badRequest("Koordinata noto'g'ri");
    }
    if (!validRanking(body.fishMost, body.fishMid, body.fishLeast)) {
      return badRequest("Eng ko'p, o'rtacha va eng kam baliq turini tanlang (uchalasi har xil bo'lishi kerak)");
    }

    const times = Array.isArray(body.times)
      ? body.times.filter((t): t is string => typeof t === "string" && (TIMES as readonly string[]).includes(t))
      : [];
    const region = isRegion(body.region) ? body.region : await detectRegion(lat, lng);

    const r = await query<{ id: number }>(
      `INSERT INTO spots (owner_id, owner_name, lat, lng, name, region, fish_most, fish_mid, fish_least, bait, times, note)
       VALUES ($1, $12, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        String(user.id),
        lat,
        lng,
        str(body.name, 100),
        region,
        body.fishMost,
        body.fishMid,
        body.fishLeast,
        str(body.bait, 500),
        times,
        str(body.note, 3000),
        displayName(user),
      ]
    );
    return NextResponse.json(await getSpot(r.rows[0].id, String(user.id)));
  } catch (e) {
    return fail(e);
  }
}
