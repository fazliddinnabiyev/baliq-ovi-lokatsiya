import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { verifyInitData } from "@/lib/auth";
import { getSpotEditable } from "@/lib/spots";

export const dynamic = "force-dynamic";

/**
 * Katta fayllar (video) uchun: brauzer Blob'ga to'g'ridan-to'g'ri yuklaydi,
 * bu route esa faqat ruxsat (token) beradi.
 */
export async function POST(request: Request) {
  const params = new URL(request.url).searchParams;
  const initData = params.get("init") || "";
  const spotId = Number(params.get("spot"));

  try {
    const body = (await request.json()) as HandleUploadBody;
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const user = verifyInitData(initData);
        if (!user) throw new Error("Ruxsat yo'q");
        const spot = await getSpotEditable(spotId, String(user.id));
        if (!spot) throw new Error("Joy topilmadi");
        return {
          allowedContentTypes: ["image/*", "video/*"],
          maximumSizeInBytes: 200 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // Bog'lash mijoz tomonidan /api/spots/[id]/media orqali qilinadi.
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Xatolik" }, { status: 400 });
  }
}
