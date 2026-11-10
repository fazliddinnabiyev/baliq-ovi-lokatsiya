import { NextResponse } from "next/server";
import { appUrl } from "@/lib/http";
import { FISH, NONE } from "@/lib/fish";
import { regionShort } from "@/lib/regions";
import { webhookSecret } from "@/lib/secret";
import { getSpotByToken } from "@/lib/spots";
import { createIncompleteSpot, warnStale } from "@/lib/incomplete";
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

const GUIDE = (name: string) =>
  `🎣 Assalomu alaykum${name}!\n\n` +
  "Bu — baliqchilar uchun umumiy xarita. Har kim topgan joyini qo'shadi, hamma ko'radi va fikr bildiradi.\n\n" +
  "📍 JOY QO'SHISH\n" +
  "1. Chat pastidagi 📎 (skrepka) tugmasini bosing\n" +
  "2. «Location» (Joylashuv) ni tanlang va baliq ovlagan joyingizni yuboring\n" +
  "3. Bot «🎣 Joyni to'ldirish» tugmasini beradi, uni bosing\n" +
  "4. Baliq turlarini tanlang (eng ko'p / o'rtacha / eng kam; baliq yo'q bo'lsa «Yo'q»), yem va vaqtni yozing, rasm qo'shing\n" +
  "5. «Joyni saqlash» ni bosing — joy hammaga ko'rinadi\n\n" +
  "🗺 XARITA\n" +
  "• Pastdagi tugma orqali xaritani oching, joy belgisini bosing — baliq, yem, vaqt, rasmlar chiqadi\n" +
  "• 🧭 Qanday boriladi — Google Xarita, Yandex va boshqa navigatorlarda yo'l olish\n" +
  "• ⬇️ Yuklab olish — boshqaning joyini o'z ro'yxatingizga nusxalash\n" +
  "• 💬 Komment — joy egasiga savol yoki fikr yozing\n" +
  "• 📤 Ulashish — do'stingizga aynan shu joyni yuboring\n\n" +
  "✏️ Joy ma'lumotlarini faqat uning egasi o'zgartira oladi.\n\n" +
  "Qayta ko'rish uchun /yordam buyrug'ini yuboring.";

async function handleMessage(msg: Msg, base: string) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId) return;

  const text = (msg.text || "").trim();

  // Do'st ulashgan joy: /start s_<token>. Hamma ochishi mumkin (faqat ko'rish uchun).
  const shared = text.match(/^\/start(?:@\w+)?\s+s_([a-f0-9]{16})$/);
  if (shared) {
    const spot = await getSpotByToken(shared[1]);
    if (spot) {
      const fish = [
        ["🥇", "Eng ko'p", spot.fishMost],
        ["🥈", "O'rtacha", spot.fishMid],
        ["🥉", "Eng kam", spot.fishLeast],
      ]
        .filter((f) => f[2] && (FISH as readonly string[]).includes(f[2] as string))
        .map((f) => `${f[0]} ${f[1]}: ${f[2]}`);
      await tgCall("sendMessage", {
        chat_id: chatId,
        text:
          `🎣 Do'stingiz baliq ovi joyini ulashdi${spot.name ? `: ${spot.name}` : ""}\n` +
          `📍 ${regionShort(spot.region) || "O'zbekiston"}\n` +
          (fish.length ? `\n${fish.join("\n")}\n` : spot.fishMost === NONE ? "\nBu joyda baliq deyarli yo'q.\n" : "") +
          `\nYo'l, yem, vaqt va rasmlar Mini App'da. Pastdagi tugmani bosing.`,
        reply_markup: openButton(base, "🎣 Joyni ko'rish", `?shared=${shared[1]}`),
      });
      return;
    }
  }

  // Lokatsiya kelganda joy darrov xaritaga qo'shiladi (to'liq emas, boshqa rangda). Baliq turlari
  // kiritilgach to'liq bo'ladi. Egasi to'ldirmasa, boshqalar ham to'ldira oladi.
  if (msg.location && msg.from) {
    const id = await createIncompleteSpot(msg.from, msg.location.latitude, msg.location.longitude);
    await tgCall("sendMessage", {
      chat_id: chatId,
      text:
        "📍 Lokatsiya xaritaga qo'shildi, lekin hali to'liq emas.\n" +
        "Pastdagi tugmani bosib baliq turlarini tanlang. Aks holda joy xaritada boshqacha rangda turadi va boshqalar to'ldirishi mumkin.",
      reply_markup: openButton(base, "🎣 Joyni to'ldirish", `?spot=${id}`),
    });
    return;
  }

  if (text.startsWith("/start") || /^\/(yordam|help)\b/.test(text)) {
    const name = msg.from?.first_name ? `, ${msg.from.first_name}` : "";
    await tgCall("sendMessage", {
      chat_id: chatId,
      text: GUIDE(name),
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
    await warnStale(appUrl(req));
  } catch (e) {
    // Telegram qayta-qayta yubormasligi uchun har doim 200 qaytaramiz.
    console.error("Webhook xatosi", e);
  }
  return NextResponse.json({ ok: true });
}
