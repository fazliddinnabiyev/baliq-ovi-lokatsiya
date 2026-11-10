import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { TIMES, validRanking } from "@/lib/fish";
import { badRequest, fail, notFound, unauthorized } from "@/lib/http";
import { isRegion } from "@/lib/regions";
import { getSpot, getSpotEditable, getSpotPublic } from "@/lib/spots";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const spot = await getSpotPublic(Number(id), String(user.id));
    return spot ? NextResponse.json(spot) : notFound();
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const spotId = Number(id);
    if (!Number.isInteger(spotId)) return notFound();

    // Egasi har doim o'zgartira oladi. To'liq bo'lmagan joyni hamma to'ldira oladi (bir marta), keyin faqat egasi.
    const current = await getSpotEditable(spotId, String(user.id));
    if (!current) return NextResponse.json({ error: "Бу жойни фақат эгаси ўзгартира олади" }, { status: 403 });

    const body = (await req.json()) as Record<string, unknown>;
    if (!current.mine && !validRanking(body.fishMost, body.fishMid, body.fishLeast)) {
      return badRequest("Жойни тўлдириш учун учала балиқ турини танланг");
    }
    const sets: string[] = [];
    const vals: unknown[] = [];
    const add = (col: string, v: unknown) => {
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    };

    if ("name" in body) add("name", str(body.name, 100));
    if ("bait" in body) add("bait", str(body.bait, 500));
    if ("note" in body) add("note", str(body.note, 3000));

    // Baliq turlari majburiy: yuborilsa uchalasi ham to'g'ri va bir-biridan farqli bo'lishi shart.
    if ("fishMost" in body || "fishMid" in body || "fishLeast" in body) {
      if (!validRanking(body.fishMost, body.fishMid, body.fishLeast)) {
        return badRequest("Энг кўп, ўртача ва энг кам балиқ турини танланг (учаласи ҳар хил бўлиши керак)");
      }
      add("fish_most", body.fishMost);
      add("fish_mid", body.fishMid);
      add("fish_least", body.fishLeast);
      sets.push("incomplete = false");
    }

    if ("region" in body) {
      if (!isRegion(body.region)) return badRequest("Вилоят нотўғри");
      add("region", body.region);
    }

    if ("times" in body) {
      const arr = Array.isArray(body.times)
        ? body.times.filter(
            (t): t is string => typeof t === "string" && (TIMES as readonly string[]).includes(t)
          )
        : [];
      add("times", arr);
    }

    if (sets.length === 0) return badRequest("Ўзгартириш учун майдон йўқ");

    vals.push(spotId, String(user.id));
    const r = await query(
      `UPDATE spots SET ${sets.join(", ")}, updated_at = now()
       WHERE id = $${vals.length - 1} AND (owner_id = $${vals.length} OR incomplete = true)`,
      vals
    );
    if (!r.rowCount) return notFound();

    return NextResponse.json(await getSpotPublic(spotId, String(user.id)));
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const spot = await getSpot(Number(id), String(user.id));
    if (!spot) return notFound();

    const urls = spot.media.map((m) => m.url);
    if (urls.length) {
      try {
        await del(urls);
      } catch (e) {
        console.error("Blob ўчиришда хато", e);
      }
    }
    await query(`DELETE FROM spots WHERE id = $1 AND owner_id = $2`, [spot.id, String(user.id)]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
