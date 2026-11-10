import { NextResponse } from "next/server";
import { verifyInitData } from "@/lib/auth";
import { appUrl, fail, unauthorized } from "@/lib/http";
import { warnOwner } from "@/lib/incomplete";

export const dynamic = "force-dynamic";

/** Foydalanuvchi to'liq bo'lmagan joyni qoldirib chiqib ketdi: darrov (bir marta) ogohlantiramiz. */
export async function POST(req: Request) {
  try {
    const user = verifyInitData(new URL(req.url).searchParams.get("init") || "");
    if (!user) return unauthorized();
    await warnOwner(String(user.id), appUrl(req));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
