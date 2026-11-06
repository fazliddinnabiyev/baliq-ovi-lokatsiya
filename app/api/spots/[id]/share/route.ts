import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { fail, notFound, unauthorized } from "@/lib/http";
import { getSpotPublic } from "@/lib/spots";
import { botUsername } from "@/lib/telegram";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Joy uchun ulashish havolasi: do'st botga Start bosadi va shu joy ochiladi. */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const spot = await getSpotPublic(Number(id), String(user.id));
    if (!spot) return notFound();

    const cur = await query<{ share_token: string | null }>(
      `SELECT share_token FROM spots WHERE id = $1`,
      [spot.id]
    );
    let token = cur.rows[0]?.share_token ?? null;
    if (!token) {
      token = crypto.randomBytes(8).toString("hex");
      await query(`UPDATE spots SET share_token = $1 WHERE id = $2`, [token, spot.id]);
    }

    const username = await botUsername();
    return NextResponse.json({ url: `https://t.me/${username}?start=s_${token}`, token });
  } catch (e) {
    return fail(e);
  }
}
