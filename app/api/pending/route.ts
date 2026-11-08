import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, fail, unauthorized } from "@/lib/http";
import { clearPending, getPending, savePending } from "@/lib/pending";

export const dynamic = "force-dynamic";

/** Yakunlanmagan joy bormi? */
export async function GET(req: Request) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();
    return NextResponse.json({ pending: await getPending(String(user.id)) });
  } catch (e) {
    return fail(e);
  }
}

/** Eski tugmalardan (?new=lat,lng) kelgan lokatsiyani yakunlanmagan deb qayd etadi. */
export async function POST(req: Request) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();
    const b = (await req.json()) as { lat?: unknown; lng?: unknown };
    const lat = Number(b.lat);
    const lng = Number(b.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return badRequest("Koordinata noto'g'ri");
    }
    await savePending(String(user.id), user.id, lat, lng);
    return NextResponse.json({ pending: { lat, lng } });
  } catch (e) {
    return fail(e);
  }
}

/** Joyni saqlamasdan bekor qilish. */
export async function DELETE(req: Request) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();
    await clearPending(String(user.id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
