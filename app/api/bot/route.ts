import { NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { botUsername } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/** Botning ommaviy nomi (reklama va havolalar uchun). */
export async function GET() {
  try {
    return NextResponse.json({ username: await botUsername() });
  } catch (e) {
    return fail(e);
  }
}
