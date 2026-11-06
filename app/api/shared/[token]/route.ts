import { NextResponse } from "next/server";
import { requireUser, verifyInitData } from "@/lib/auth";
import { query } from "@/lib/db";
import { fail, notFound, unauthorized } from "@/lib/http";
import { getSpot, getSpotByToken } from "@/lib/spots";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

/** Ulashilgan joyni ko'rish: istalgan Telegram foydalanuvchisi (havolani olgan do'st) ochishi mumkin. */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = verifyInitData(req.headers.get("x-telegram-init-data") || "");
    if (!user) return unauthorized();
    const { token } = await ctx.params;
    const spot = await getSpotByToken(token);
    return spot ? NextResponse.json(spot) : notFound();
  } catch (e) {
    return fail(e);
  }
}

/** Ulashilgan joyni o'z ro'yxatiga saqlash (rasm/videolarsiz nusxa). */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();
    const { token } = await ctx.params;
    const src = await getSpotByToken(token);
    if (!src) return notFound();

    const r = await query<{ id: number }>(
      `INSERT INTO spots (owner_id, lat, lng, name, region, fish_most, fish_mid, fish_least, bait, times, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        String(user.id),
        src.lat,
        src.lng,
        src.name,
        src.region,
        src.fishMost,
        src.fishMid,
        src.fishLeast,
        src.bait,
        src.times,
        src.note,
      ]
    );
    return NextResponse.json(await getSpot(r.rows[0].id, String(user.id)));
  } catch (e) {
    return fail(e);
  }
}
