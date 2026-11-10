export function initData(): string {
  return window.Telegram?.WebApp?.initData ?? "";
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-telegram-init-data": initData(),
      ...((init.headers as Record<string, string>) || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Хатолик ${res.status}`);
  return data as T;
}

export function openLink(url: string) {
  const w = window.Telegram?.WebApp;
  if (w?.openLink) w.openLink(url);
  else window.open(url, "_blank");
}

/** Havola tashqi brauzer/ilovada ochiladi; ilova sxemalari (yandexnavi:// va h.k.) to'g'ridan-to'g'ri. */
export function openExternal(url: string) {
  if (/^https?:/i.test(url)) openLink(url);
  else window.location.href = url;
}

export function openTelegramLink(url: string) {
  const w = window.Telegram?.WebApp;
  if (w?.openTelegramLink) w.openTelegramLink(url);
  else window.open(url, "_blank");
}

export function confirmDialog(message: string): Promise<boolean> {
  const w = window.Telegram?.WebApp;
  if (w?.showConfirm) {
    return new Promise((resolve) => w.showConfirm(message, (ok: boolean) => resolve(ok)));
  }
  return Promise.resolve(window.confirm(message));
}

/** Katta rasmlarni yuklashdan oldin kichraytiradi (joy tejash va tezlik uchun). */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 1.2 * 1024 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
