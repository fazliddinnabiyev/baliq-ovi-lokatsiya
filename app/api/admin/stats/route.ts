import { NextResponse } from "next/server";
import { isAdmin, requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { collectStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = requireUser(req);
    // Boshqalarga sahifa umuman yo'qdek ko'rinadi.
    if (!isAdmin(user)) return NextResponse.json({ error: "Топилмади" }, { status: 404 });
    return NextResponse.json(await collectStats());
  } catch (e) {
    return fail(e);
  }
}
