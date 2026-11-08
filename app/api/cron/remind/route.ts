import { NextResponse } from "next/server";
import { appUrl } from "@/lib/http";
import { remindStale } from "@/lib/pending";

export const dynamic = "force-dynamic";

/** Vercel Cron kuniga bir marta chaqiradi. Eslatmalar tezligi bazada cheklangan, shuning uchun xavfsiz. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const ua = req.headers.get("user-agent") || "";
  const okAuth = secret ? req.headers.get("authorization") === `Bearer ${secret}` : false;
  if (!okAuth && !ua.startsWith("vercel-cron")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sent = await remindStale(appUrl(req), true);
  return NextResponse.json({ sent });
}
