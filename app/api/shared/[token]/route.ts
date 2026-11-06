import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { fail, notFound, unauthorized } from "@/lib/http";
import { getSpotByToken } from "@/lib/spots";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

/** Ulashilgan havola bo'yicha joyni topish (ilova uni xaritada ochadi). */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = requireUser(req);
    if (!user) return unauthorized();
    const { token } = await ctx.params;
    const spot = await getSpotByToken(token, String(user.id));
    return spot ? NextResponse.json(spot) : notFound();
  } catch (e) {
    return fail(e);
  }
}
