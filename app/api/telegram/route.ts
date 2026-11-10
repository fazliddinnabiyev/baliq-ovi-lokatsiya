import { NextResponse } from "next/server";
import { appUrl } from "@/lib/http";
import { FISH, NONE } from "@/lib/fish";
import { cyr } from "@/lib/cyr";
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
  `🎣 Ассалому алайкум${name}!\n\n` +
  "Бу — балиқчилар учун умумий харита. Ҳар ким топган жойини қўшади, ҳамма кўради ва фикр билдиради.\n\n" +
  "📍 ЖОЙ ҚЎШИШ\n" +
  "1. Чат пастидаги 📎 (скрепка) тугмасини босинг\n" +
  "2. «Location» (Жойлашув) ни танланг ва балиқ овлаган жойингизни юборинг\n" +
  "3. Bot «🎣 Жойни тўлдириш» тугмасини беради, уни босинг\n" +
  "4. Балиқ турларини танланг (энг кўп / ўртача / энг кам; балиқ йўқ бўлса «Йўқ»), ем ва вақтни ёзинг, расм қўшинг\n" +
  "5. «Жойни сақлаш» ни босинг — жой ҳаммага кўринади\n\n" +
  "🗺 ХАРИТА\n" +
  "• Пастдаги тугма орқали харитани очинг, жой белгисини босинг — балиқ, ем, вақт, расмлар чиқади\n" +
  "• 🧭 Қандай борилади — Гугл Харита, Яндекс ва бошқа навигаторларда йўл олиш\n" +
  "• 💬 Коммент — жой эгасига савол ёки фикр ёзинг\n" +
  "• 📤 Улашиш — дўстингизга айнан шу жойни юборинг\n\n" +
  "✏️ Жой маълумотларини фақат унинг эгаси ўзгартира олади.\n\n" +
  "Қайта кўриш учун /yordam буйруғини юборинг.";

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
        ["🥇", "Энг кўп", spot.fishMost],
        ["🥈", "Ўртача", spot.fishMid],
        ["🥉", "Энг кам", spot.fishLeast],
      ]
        .filter((f) => f[2] && (FISH as readonly string[]).includes(f[2] as string))
        .map((f) => `${f[0]} ${f[1]}: ${cyr(f[2] as string)}`);
      await tgCall("sendMessage", {
        chat_id: chatId,
        text:
          `🎣 Дўстингиз балиқ ови жойини улашди${spot.name ? `: ${spot.name}` : ""}\n` +
          `📍 ${cyr(regionShort(spot.region)) || "Ўзбекистон"}\n` +
          (fish.length ? `\n${fish.join("\n")}\n` : spot.fishMost === NONE ? "\nБу жойда балиқ деярли йўқ.\n" : "") +
          `\nЙўл, ем, вақт ва расмлар Mini Аппъда. Пастдаги тугмани босинг.`,
        reply_markup: openButton(base, "🎣 Жойни кўриш", `?shared=${shared[1]}`),
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
        "📍 Локация харитага қўшилди, лекин ҳали тўлиқ эмас.\n" +
        "Пастдаги тугмани босиб балиқ турларини танланг. Акс ҳолда жой харитада бошқача рангда туради ва бошқалар тўлдириши мумкин.",
      reply_markup: openButton(base, "🎣 Жойни тўлдириш", `?spot=${id}`),
    });
    return;
  }

  if (text.startsWith("/start") || /^\/(yordam|help)\b/.test(text)) {
    const name = msg.from?.first_name ? `, ${msg.from.first_name}` : "";
    await tgCall("sendMessage", {
      chat_id: chatId,
      text: GUIDE(name),
      reply_markup: openButton(base, "🗺 Харитани очиш"),
    });
    return;
  }

  await tgCall("sendMessage", {
    chat_id: chatId,
    text: text.startsWith("/xarita") || text.startsWith("/map") ? "Харитангиз:" : "Локация юборинг (📎 → Location) ёки харитани очинг.",
    reply_markup: openButton(base, "🗺 Харитани очиш"),
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
    console.error("Webhook хатоси", e);
  }
  return NextResponse.json({ ok: true });
}
