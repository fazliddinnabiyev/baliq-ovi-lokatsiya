import { NextResponse } from "next/server";
import { isAllowed } from "@/lib/auth";
import { FISH } from "@/lib/fish";
import { appUrl } from "@/lib/http";
import { query } from "@/lib/db";
import { getSpot } from "@/lib/spots";
import { tgCall } from "@/lib/telegram";

export const dynamic = "force-dynamic";

type Msg = {
  message_id: number;
  chat: { id: number };
  from?: { id: number; first_name?: string };
  text?: string;
  location?: { latitude: number; longitude: number };
};
type Cb = {
  id: string;
  from: { id: number };
  data?: string;
  message?: { message_id: number; chat: { id: number } };
};
type Update = { message?: Msg; callback_query?: Cb };

type Stage = "m" | "d" | "l";
const STAGE_COL: Record<Stage, string> = { m: "fish_most", d: "fish_mid", l: "fish_least" };
const STAGE_TEXT: Record<Stage, string> = {
  m: "🥇 Bu joyda qaysi baliq ENG KO'P?",
  d: "🥈 O'rtacha miqdorda qaysi baliq bor?",
  l: "🥉 Qaysi baliq ENG KAM uchraydi?",
};

function fishKeyboard(spotId: number, stage: Stage, exclude: string[]) {
  const buttons = FISH.map((name, i) => ({
    text: name,
    callback_data: `f|${spotId}|${stage}|${i}`,
  })).filter((b) => !exclude.includes(b.text));

  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  rows.push([{ text: "⏭ O'tkazib yuborish", callback_data: `f|${spotId}|${stage}|x` }]);
  return { inline_keyboard: rows };
}

function openButton(base: string, spotId?: number) {
  const url = spotId ? `${base}/?spot=${spotId}` : base;
  return { inline_keyboard: [[{ text: "🗺 Xaritada ochish", web_app: { url } }]] };
}

async function handleMessage(msg: Msg, base: string) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId) return;

  if (!isAllowed(userId)) {
    await tgCall("sendMessage", { chat_id: chatId, text: "Bu bot shaxsiy foydalanish uchun." });
    return;
  }

  if (msg.location) {
    const r = await query<{ id: number }>(
      `INSERT INTO spots (owner_id, lat, lng) VALUES ($1, $2, $3) RETURNING id`,
      [String(userId), msg.location.latitude, msg.location.longitude]
    );
    const spotId = r.rows[0].id;
    await tgCall("sendMessage", {
      chat_id: chatId,
      text: `📍 Joy #${spotId} saqlandi.\n\n${STAGE_TEXT.m}`,
      reply_markup: fishKeyboard(spotId, "m", []),
    });
    return;
  }

  const text = (msg.text || "").trim();
  if (text.startsWith("/start")) {
    await tgCall("sendMessage", {
      chat_id: chatId,
      text:
        "🎣 Baliq ovi joylari\n\n" +
        "Menga lokatsiya yuboring (📎 → Location) — men uni saqlayman va qaysi baliq ko'p ekanini so'rayman.\n" +
        "Keyin xaritani ochib izoh (yem, vaqt), rasm va video qo'shishingiz mumkin.",
      reply_markup: openButton(base),
    });
    return;
  }
  if (text.startsWith("/xarita") || text.startsWith("/map")) {
    await tgCall("sendMessage", {
      chat_id: chatId,
      text: "Xaritangiz:",
      reply_markup: openButton(base),
    });
    return;
  }

  await tgCall("sendMessage", {
    chat_id: chatId,
    text: "Lokatsiya yuboring (📎 → Location) yoki xaritani oching.",
    reply_markup: openButton(base),
  });
}

async function handleCallback(cb: Cb, base: string) {
  if (!isAllowed(cb.from.id)) {
    await tgCall("answerCallbackQuery", { callback_query_id: cb.id, text: "Ruxsat yo'q" });
    return;
  }
  const parts = (cb.data || "").split("|");
  if (parts[0] !== "f" || !cb.message) {
    await tgCall("answerCallbackQuery", { callback_query_id: cb.id });
    return;
  }

  const spotId = Number(parts[1]);
  const stage = parts[2] as Stage;
  const code = parts[3];
  const owner = String(cb.from.id);
  const chatId = cb.message.chat.id;
  const messageId = cb.message.message_id;

  if (!(stage in STAGE_COL) || !(await getSpot(spotId, owner))) {
    await tgCall("answerCallbackQuery", { callback_query_id: cb.id, text: "Joy topilmadi" });
    return;
  }

  const fish = code === "x" ? null : FISH[Number(code)] ?? null;
  await query(`UPDATE spots SET ${STAGE_COL[stage]} = $1, updated_at = now() WHERE id = $2 AND owner_id = $3`, [
    fish,
    spotId,
    owner,
  ]);
  await tgCall("answerCallbackQuery", { callback_query_id: cb.id });

  const spot = await getSpot(spotId, owner);
  if (!spot) return;
  const chosen = [spot.fishMost, spot.fishMid, spot.fishLeast].filter((x): x is string => !!x);

  if (stage === "m" || stage === "d") {
    const next: Stage = stage === "m" ? "d" : "l";
    await tgCall("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: `📍 Joy #${spotId}\n\n${STAGE_TEXT[next]}`,
      reply_markup: fishKeyboard(spotId, next, chosen),
    });
    return;
  }

  const line = (icon: string, label: string, v: string | null) => `${icon} ${label}: ${v ?? "—"}`;
  await tgCall("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text:
      `✅ Joy #${spotId} saqlandi\n` +
      `📍 ${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)}\n\n` +
      `${line("🥇", "Eng ko'p", spot.fishMost)}\n` +
      `${line("🥈", "O'rtacha", spot.fishMid)}\n` +
      `${line("🥉", "Eng kam", spot.fishLeast)}\n\n` +
      `Endi xaritani ochib yem, vaqt, izoh va rasm/video qo'shing.`,
    reply_markup: openButton(base, spotId),
  });
}

export async function POST(req: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const update = (await req.json()) as Update;
    const base = appUrl(req);
    if (update.message) await handleMessage(update.message, base);
    else if (update.callback_query) await handleCallback(update.callback_query, base);
  } catch (e) {
    // Telegram qayta-qayta yubormasligi uchun har doim 200 qaytaramiz.
    console.error("Webhook xatosi", e);
  }
  return NextResponse.json({ ok: true });
}
