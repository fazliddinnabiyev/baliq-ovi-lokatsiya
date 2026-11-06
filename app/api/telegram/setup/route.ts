import { NextResponse } from "next/server";
import { appUrl } from "@/lib/http";
import { webhookSecret } from "@/lib/secret";
import { tgCall } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Bir marta ochiladi: /api/telegram/setup
 * Webhook, menyu tugmasi va buyruqlarni o'rnatadi.
 * (WEBHOOK_SECRET o'rnatilgan bo'lsa, ?secret=... ham talab qilinadi.)
 * Telegram'da kutib turgan eski xabarlar (masalan, oldin bosilgan /start) o'chirilmaydi —
 * webhook ulanishi bilan ular qayta ishlanadi.
 */
export async function GET(req: Request) {
  if (!process.env.BOT_TOKEN) {
    return NextResponse.json({ error: "BOT_TOKEN o'rnatilmagan" }, { status: 400 });
  }
  const explicit = process.env.WEBHOOK_SECRET;
  if (explicit && new URL(req.url).searchParams.get("secret") !== explicit) {
    return NextResponse.json({ error: "secret noto'g'ri" }, { status: 401 });
  }

  const secret = webhookSecret();
  const base = appUrl(req);
  const webhook = await tgCall("setWebhook", {
    url: `${base}/api/telegram`,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
  const menu = await tgCall("setChatMenuButton", {
    menu_button: { type: "web_app", text: "🗺 Xarita", web_app: { url: base } },
  });
  const commands = await tgCall("setMyCommands", {
    commands: [
      { command: "start", description: "Boshlash" },
      { command: "xarita", description: "Xaritani ochish" },
      { command: "yordam", description: "Qanday foydalanish" },
    ],
  });

  return NextResponse.json({ base, webhook, menu, commands });
}
