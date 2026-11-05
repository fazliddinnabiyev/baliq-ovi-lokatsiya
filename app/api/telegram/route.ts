import { NextResponse } from "next/server";
import { isAllowed } from "@/lib/auth";
import { appUrl } from "@/lib/http";
import { webhookSecret } from "@/lib/secret";
import { tgCall } from "@/lib/telegram";

export const dynamic = "force-dynamic";

type Msg = {
  message_id: number;
  chat: { id: number };
  from?: { id: number; first_name?: string };
  text?: string;
  location?: { latitude: number; longitude: number };
};
type Update = { message?: Msg };

function openButton(base: string, label: string, query = "") {
  return { inline_keyboard: [[{ text: label, web_app: { url: `${base}/${query}` } }]] };
}

async function handleMessage(msg: Msg, base: string) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId) return;

  if (!isAllowed(userId)) {
    await tgCall("sendMessage", { chat_id: chatId, text: "Bu bot shaxsiy foydalanish uchun." });
    return;
  }

  // Lokatsiya kelganda hech narsa saqlanmaydi: Mini App shu nuqta bilan ochiladi,
  // baliq turlari tanlangandan keyingina joy saqlanadi.
  if (msg.location) {
    const { latitude, longitude } = msg.location;
    await tgCall("sendMessage", {
      chat_id: chatId,
      text: "📍 Lokatsiya qabul qilindi.\nPastdagi tugmani bosing: baliq turlarini tanlab, joyni saqlaysiz.",
      reply_markup: openButton(base, "🎣 Joyni to'ldirish", `?new=${latitude.toFixed(6)},${longitude.toFixed(6)}`),
    });
    return;
  }

  const text = (msg.text || "").trim();
  if (text.startsWith("/start")) {
    const name = msg.from?.first_name ? `, ${msg.from.first_name}` : "";
    await tgCall("sendMessage", {
      chat_id: chatId,
      text:
        `🎣 Assalomu alaykum${name}!\n\n` +
        "Bu — sizning shaxsiy baliq ovi daftaringiz. Topgan joylaringiz bir xaritada jamlanadi va keyingi mavsumda esingizdan chiqmaydi.\n\n" +
        "📍 Yangi joy qo'shish: menga lokatsiya yuboring (📎 → Location). Men Mini App'ni shu joy bilan ochib beraman.\n" +
        "🗺 Saqlangan joylarni ko'rish: pastdagi tugmani bosing.",
      reply_markup: openButton(base, "🗺 Xaritani ochish"),
    });
    return;
  }

  await tgCall("sendMessage", {
    chat_id: chatId,
    text: text.startsWith("/xarita") || text.startsWith("/map") ? "Xaritangiz:" : "Lokatsiya yuboring (📎 → Location) yoki xaritani oching.",
    reply_markup: openButton(base, "🗺 Xaritani ochish"),
  });
}

export async function POST(req: Request) {
  const expected = webhookSecret();
  if (!expected || req.headers.get("x-telegram-bot-api-secret-token") !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const update = (await req.json()) as Update;
    if (update.message) await handleMessage(update.message, appUrl(req));
  } catch (e) {
    // Telegram qayta-qayta yubormasligi uchun har doim 200 qaytaramiz.
    console.error("Webhook xatosi", e);
  }
  return NextResponse.json({ ok: true });
}
