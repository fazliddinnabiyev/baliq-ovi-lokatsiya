import { NextResponse } from "next/server";
import { verifyInitData } from "@/lib/auth";
import { query } from "@/lib/db";
import { appUrl } from "@/lib/http";
import { PENDING_TEXT, pendingButton } from "@/lib/pending";
import { tgCall } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Foydalanuvchi joyni yakunlamasdan ilovadan chiqib ketganda (sendBeacon) darrov eslatma yuboradi.
 * Auth: initData so'rov manzilida (sendBeacon sarlavha qo'sha olmaydi).
 */
export async function POST(req: Request) {
  try {
    const user = verifyInitData(new URL(req.url).searchParams.get("init") || "");
    if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    // Ketma-ket ko'p xabar yubormaslik: 2 daqiqada bittadan.
    const r = await query<{ chat_id: string }>(
      `UPDATE pending_spots SET reminded_at = now(), remind_count = remind_count + 1
       WHERE owner_id = $1 AND (reminded_at IS NULL OR reminded_at < now() - interval '2 minutes')
       RETURNING chat_id`,
      [String(user.id)]
    );
    if (r.rows[0]) {
      await tgCall("sendMessage", {
        chat_id: Number(r.rows[0].chat_id),
        text: PENDING_TEXT,
        reply_markup: pendingButton(appUrl(req)),
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false });
  }
}
