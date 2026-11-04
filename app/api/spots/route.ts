import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { badRequest, fail, unauthorized } from "@/lib/http";
import { getSpot, listSpots } from "@/lib/spots";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();
    return NextResponse.json(await listSpots(String(user.id)));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();

    const body = (await req.json()) as { lat?: unknown; lng?: unknown; name?: unknown };
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return badRequest("Koordinata noto'g'ri");
    }
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";

    const r = await query<{ id: number }>(
      `INSERT INTO spots (owner_id, lat, lng, name) VALUES ($1, $2, $3, $4) RETURNING id`,
      [String(user.id), lat, lng, name]
    );
    return NextResponse.json(await getSpot(r.rows[0].id, String(user.id)));
  } catch (e) {
    return fail(e);
  }
}
