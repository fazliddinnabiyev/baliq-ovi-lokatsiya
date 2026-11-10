import { NextResponse } from "next/server";

export const unauthorized = () =>
  NextResponse.json({ error: "Рухсат йўқ. Иловани Телеграм ичидан очинг." }, { status: 401 });

export const badRequest = (msg: string) => NextResponse.json({ error: msg }, { status: 400 });

export const notFound = () => NextResponse.json({ error: "Топилмади" }, { status: 404 });

export function fail(e: unknown) {
  console.error(e);
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "Сервер хатоси" },
    { status: 500 }
  );
}

export function appUrl(req: Request): string {
  return (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
}
