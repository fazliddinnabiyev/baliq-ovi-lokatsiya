import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { FISH, TIMES } from "@/lib/fish";
import { badRequest, fail, notFound, unauthorized } from "@/lib/http";
import { getSpot } from "@/lib/spots";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const spot = await getSpot(Number(id), String(user.id));
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

    const body = (await req.json()) as Record<string, unknown>;
    const sets: string[] = [];
    const vals: unknown[] = [];
    const add = (col: string, v: unknown) => {
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    };

    if ("name" in body) add("name", str(body.name, 100));
    if ("bait" in body) add("bait", str(body.bait, 500));
    if ("note" in body) add("note", str(body.note, 3000));

    const fishFields = [
      ["fishMost", "fish_most"],
      ["fishMid", "fish_mid"],
      ["fishLeast", "fish_least"],
    ] as const;
    for (const [key, col] of fishFields) {
      if (!(key in body)) continue;
      const v = body[key];
      if (v === null || v === "") add(col, null);
      else if (typeof v === "string" && (FISH as readonly string[]).includes(v)) add(col, v);
      else return badRequest("Baliq nomi noto'g'ri");
    }

    if ("times" in body) {
      const arr = Array.isArray(body.times)
        ? body.times.filter(
            (t): t is string => typeof t === "string" && (TIMES as readonly string[]).includes(t)
          )
        : [];
      add("times", arr);
    }

    if (sets.length === 0) return badRequest("O'zgartirish uchun maydon yo'q");

    vals.push(spotId, String(user.id));
    const r = await query(
      `UPDATE spots SET ${sets.join(", ")}, updated_at = now()
       WHERE id = $${vals.length - 1} AND owner_id = $${vals.length}`,
      vals
    );
    if (!r.rowCount) return notFound();

    return NextResponse.json(await getSpot(spotId, String(user.id)));
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
        console.error("Blob o'chirishda xato", e);
      }
    }
    await query(`DELETE FROM spots WHERE id = $1 AND owner_id = $2`, [spot.id, String(user.id)]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
