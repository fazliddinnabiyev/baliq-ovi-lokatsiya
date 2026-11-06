# 🎣 Baliq ovi joylari — Telegram bot + Mini App

Botga lokatsiya yuborasiz → bot qaysi baliq ko'pligini so'raydi (eng ko'p / o'rtacha / eng kam) →
Mini App'da barcha joylar bitta xaritada ko'rinadi. Har bir joyga yem, kunning qaysi qismi,
izoh, rasm va video qo'shasiz.

**Texnologiyalar:** Next.js 15, TypeScript, Postgres (`pg`), Vercel Blob, Leaflet (OpenStreetMap + sun'iy yo'ldosh).

## Qanday ishlaydi

- `/start` → bot salom beradi va "Xaritada ochish" tugmasini ko'rsatadi.
- Lokatsiya yuborasiz (📎 → Location) → joy saqlanadi → 3 ta savol (eng ko'p, o'rtacha, eng kam baliq).
- Xaritada 🎣 belgisini bossangiz pastdan panel chiqadi: baliqlar, yem, vaqt, izoh, rasm/video.
- Xaritadagi ＋ tugmasi bilan lokatsiyasiz ham joy qo'shish mumkin.
- Har kim faqat o'z joylarini ko'radi (Telegram ID bo'yicha).

## Ishga tushirish (Vercel)

1. **Bot yaratish.** Telegram'da [@BotFather](https://t.me/BotFather) → `/newbot` → tokenni oling.
2. **Vercel'da loyiha** → Settings → General → **Framework Preset: Next.js** bo'lsin.
3. **Storage ulang** (Vercel loyihasi → Storage):
   - **Postgres (Neon)** → `DATABASE_URL` o'zi qo'shiladi (jadvallar birinchi so'rovda avtomatik yaratiladi).
   - **Blob** → `BLOB_READ_WRITE_TOKEN` o'zi qo'shiladi.
4. **Environment Variables** qo'shing (Settings → Environment Variables):
   - `BOT_TOKEN` — BotFather bergan token
   - `WEBHOOK_SECRET` — o'zingiz o'ylab topgan uzun matn (harf, raqam, `_`, `-`)
   - `ALLOWED_USER_IDS` — (ixtiyoriy) faqat o'zingizning Telegram ID'ingiz, masalan `123456789`
   - `APP_URL` — (ixtiyoriy) masalan `https://sizning-loyiha.vercel.app`
5. **Deploy** qiling (Redeploy).
6. Brauzerda bir marta oching (webhook va menyu tugmasini o'rnatadi):

   ```
   https://SIZNING-LOYIHA.vercel.app/api/telegram/setup?secret=WEBHOOK_SECRET_QIYMATI
   ```

   Javobda `"ok": true` ko'rinsa tayyor.
7. Botga `/start` yozing va lokatsiya yuboring.

## Xarita

Xarita kalitsiz va bepul: Xarita (CARTO), Batafsil (OpenStreetMap), Relyef (OpenTopoMap) va Yo'ldosh (Esri, nomlari bilan).
Xaritaning yuqori o'ng burchagidagi tugmadan almashtiriladi, tanlov eslab qolinadi.

## Baliq turlarini o'zgartirish

`lib/fish.ts` faylida `FISH` (baliq nomlari) va `TIMES` (kun qismlari) ro'yxati bor — shu yerda tahrirlang.

## Mahalliy ishga tushirish

```bash
npm install
cp .env.example .env.local   # qiymatlarni to'ldiring
npm run dev
```

Mini App faqat Telegram ichida (initData bilan) ishlaydi.
