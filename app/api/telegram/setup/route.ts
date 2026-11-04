import { NextResponse } from "next/server";
import { appUrl } from "@/lib/http";
import { tgCall } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Bir marta ochiladi: /api/telegram/setup?secret=WEBHOOK_SECRET
 * Webhook, menyu tugmasi va buyruqlarni o'rnatadi.
 */
export async function GET(req: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || new URL(req.url).searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "secret noto'g'ri" }, { status: 401 });
  }
  if (!process.env.BOT_TOKEN) {
    return NextResponse.json({ error: "BOT_TOKEN o'rnatilmagan" }, { status: 400 });
  }

  const base = appUrl(req);
  const webhook = await tgCall("setWebhook", {
    url: `${base}/api/telegram`,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  const menu = await tgCall("setChatMenuButton", {
    menu_button: { type: "web_app", text: "🗺 Xarita", web_app: { url: base } },
  });
  const commands = await tgCall("setMyCommands", {
    commands: [
      { command: "start", description: "Boshlash" },
      { command: "xarita", description: "Xaritani ochish" },
    ],
  });

  return NextResponse.json({ base, webhook, menu, commands });
}
