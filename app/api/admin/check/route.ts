import { NextResponse } from "next/server";
import { isAdmin, requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAdmin(requireUser(req))) return NextResponse.json({ error: "Топилмади" }, { status: 404 });
  return NextResponse.json({ admin: true });
}
