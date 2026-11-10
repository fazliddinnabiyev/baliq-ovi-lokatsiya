import { NextResponse } from "next/server";
import { displayName, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { fail, notFound, unauthorized } from "@/lib/http";
import { getSpot, getSpotPublic } from "@/lib/spots";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Boshqa foydalanuvchi joyini o'z ro'yxatiga yuklab olish (rasm/videolarsiz nusxa). */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();
    const me = String(user.id);
    const { id } = await ctx.params;
    const src = await getSpotPublic(Number(id), me);
    if (!src) return notFound();
    if (src.mine) return NextResponse.json(src);
    if (src.incomplete) return NextResponse.json({ error: "Bu joy hali to'liq emas" }, { status: 400 });

    // Bir joyni ikki marta yuklab olmaslik uchun: shu koordinatada o'zining joyi bo'lsa, o'shani qaytaramiz.
    const dup = await query<{ id: number }>(
      `SELECT id FROM spots WHERE owner_id = $1 AND lat = $2 AND lng = $3 AND draft = false LIMIT 1`,
      [me, src.lat, src.lng]
    );
    if (dup.rows[0]) return NextResponse.json(await getSpot(dup.rows[0].id, me));

    const r = await query<{ id: number }>(
      `INSERT INTO spots (owner_id, owner_name, lat, lng, name, region, fish_most, fish_mid, fish_least, bait, times, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [me, displayName(user), src.lat, src.lng, src.name, src.region, src.fishMost, src.fishMid, src.fishLeast, src.bait, src.times, src.note]
    );
    return NextResponse.json(await getSpot(r.rows[0].id, me));
  } catch (e) {
    return fail(e);
  }
}
