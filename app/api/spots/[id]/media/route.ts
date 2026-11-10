import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { badRequest, fail, notFound, unauthorized } from "@/lib/http";
import { getSpotEditable } from "@/lib/spots";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Yuklangan faylni joyga bog'laydi (fayl brauzerdan to'g'ridan-to'g'ri Blob'ga yuklanadi). */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const spot = await getSpotEditable(Number(id), String(user.id));
    if (!spot) return notFound();

    const body = (await req.json()) as { url?: unknown; kind?: unknown };
    if (typeof body.url !== "string") return badRequest("url kerak");
    let host = "";
    try {
      host = new URL(body.url).hostname;
    } catch {
      return badRequest("url noto'g'ri");
    }
    if (!host.endsWith(".public.blob.vercel-storage.com")) return badRequest("Faqat Blob manzillari qabul qilinadi");
    const kind = body.kind === "video" ? "video" : "image";

    const r = await query<{ id: number }>(
      `INSERT INTO spot_media (spot_id, url, kind) VALUES ($1, $2, $3) RETURNING id`,
      [spot.id, body.url, kind]
    );
    await query(`UPDATE spots SET updated_at = now() WHERE id = $1`, [spot.id]);
    return NextResponse.json({ id: r.rows[0].id, url: body.url, kind });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const spot = await getSpotEditable(Number(id), String(user.id));
    if (!spot) return notFound();

    const mediaId = Number(new URL(req.url).searchParams.get("mediaId"));
    const media = spot.media.find((m) => m.id === mediaId);
    if (!media) return notFound();

    await query(`DELETE FROM spot_media WHERE id = $1 AND spot_id = $2`, [media.id, spot.id]);
    try {
      await del(media.url);
    } catch (e) {
      console.error("Blob o'chirishda xato", e);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
