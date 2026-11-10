import { NextResponse } from "next/server";
import { displayName, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { badRequest, fail, notFound, unauthorized } from "@/lib/http";
import { getSpotPublic } from "@/lib/spots";
import type { Comment } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

type Row = { id: number; userName: string; text: string; createdAt: string; mine: boolean; byOwner: boolean };

async function list(spotId: number, viewer: string): Promise<Comment[]> {
  const r = await query<Row>(
    `SELECT c.id, c.user_name AS "userName", c.text, c.created_at AS "createdAt",
            (c.user_id = $2) AS mine, (c.user_id = s.owner_id) AS "byOwner"
     FROM spot_comments c JOIN spots s ON s.id = c.spot_id
     WHERE c.spot_id = $1 ORDER BY c.id ASC LIMIT 300`,
    [spotId, viewer]
  );
  return r.rows;
}

export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const spot = await getSpotPublic(Number(id), String(user.id));
    if (!spot) return notFound();
    return NextResponse.json(await list(spot.id, String(user.id)));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const spot = await getSpotPublic(Number(id), String(user.id));
    if (!spot) return notFound();

    const body = (await req.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 500) : "";
    if (!text) return badRequest("Коммент бўш");

    // Spamdan himoya: bir foydalanuvchi 10 soniyada bittadan ko'p komment yoza olmaydi.
    const recent = await query(
      `SELECT 1 FROM spot_comments WHERE user_id = $1 AND created_at > now() - interval '10 seconds' LIMIT 1`,
      [String(user.id)]
    );
    if (recent.rowCount) return badRequest("Бироз кутинг, жуда тез ёзяпсиз");

    await query(`INSERT INTO spot_comments (spot_id, user_id, user_name, text) VALUES ($1, $2, $3, $4)`, [
      spot.id,
      String(user.id),
      displayName(user),
      text,
    ]);
    return NextResponse.json(await list(spot.id, String(user.id)));
  } catch (e) {
    return fail(e);
  }
}

/** Kommentni komment egasi yoki joy egasi o'chira oladi. */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const commentId = Number(new URL(req.url).searchParams.get("commentId"));
    if (!Number.isInteger(commentId)) return notFound();
    const r = await query(
      `DELETE FROM spot_comments c USING spots s
       WHERE c.id = $1 AND c.spot_id = $2 AND s.id = c.spot_id AND (c.user_id = $3 OR s.owner_id = $3)`,
      [commentId, Number(id), String(user.id)]
    );
    if (!r.rowCount) return notFound();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
