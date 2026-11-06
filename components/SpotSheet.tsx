"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";
import { api, compressImage, confirmDialog, initData, openTelegramLink } from "@/lib/client";
import { FISH, NONE, TIMES, validRanking } from "@/lib/fish";
import { OTHER_REGION, REGIONS } from "@/lib/regions";
import type { Media, Spot } from "@/lib/types";
import Comments from "./Comments";
import Directions from "./Directions";

type Props = {
  spot: Spot;
  /** true bo'lsa: joy hali saqlanmagan (xaritadan yangi belgilangan) */
  isNew?: boolean;
  onClose: () => void;
  onSaved: (spot: Spot) => void;
  onCreated?: (spot: Spot) => void;
  onDeleted: (id: number) => void;
  toast: (msg: string) => void;
};

export default function SpotSheet({ spot, isNew = false, onClose, onSaved, onCreated, onDeleted, toast }: Props) {
  const [name, setName] = useState(spot.name);
  const [region, setRegion] = useState(spot.region ?? "");
  const [fishMost, setFishMost] = useState(spot.fishMost ?? "");
  const [fishMid, setFishMid] = useState(spot.fishMid ?? "");
  const [fishLeast, setFishLeast] = useState(spot.fishLeast ?? "");
  const [bait, setBait] = useState(spot.bait);
  const [times, setTimes] = useState<string[]>(spot.times);
  const [note, setNote] = useState(spot.note);

  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [viewer, setViewer] = useState<Media | null>(null);
  const [dir, setDir] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fishValid = validRanking(fishMost, fishMid, fishLeast);

  const toggleTime = (t: string) =>
    setTimes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  async function save() {
    if (!fishValid) {
      toast("Avval uchala baliq turini tanlang");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        ...(region ? { region } : {}),
        fishMost,
        fishMid,
        fishLeast,
        bait,
        times,
        note,
      };
      if (isNew) {
        const created = await api<Spot>("/api/spots", {
          method: "POST",
          body: JSON.stringify({ ...payload, lat: spot.lat, lng: spot.lng }),
        });
        toast("Joy saqlandi ✓");
        onCreated?.(created);
      } else {
        const updated = await api<Spot>(`/api/spots/${spot.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        onSaved(updated);
        toast("Saqlandi ✓");
      }
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    try {
      const { url } = await api<{ url: string }>(`/api/spots/${spot.id}/share`, { method: "POST" });
      const text = `🎣 ${name.trim() || "Baliq ovi joyi"}: botga Start bosing, joy ochiladi`;
      openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function remove() {
    if (!(await confirmDialog("Bu joy va uning rasm/videolari o'chirilsinmi?"))) return;
    try {
      await api(`/api/spots/${spot.id}`, { method: "DELETE" });
      onDeleted(spot.id);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    let current = spot;
    try {
      for (const original of Array.from(files)) {
        const file = await compressImage(original);
        const kind = file.type.startsWith("video/") ? "video" : "image";
        const safeName = file.name.replace(/[^\w.\-]+/g, "_") || "fayl";
        setProgress("0%");
        const blob = await upload(`spots/${spot.id}/${safeName}`, file, {
          access: "public",
          handleUploadUrl: `/api/blob?spot=${spot.id}&init=${encodeURIComponent(initData())}`,
          multipart: file.size > 20 * 1024 * 1024,
          onUploadProgress: (p) => setProgress(`${Math.round(p.percentage)}%`),
        });
        const media = await api<Media>(`/api/spots/${spot.id}/media`, {
          method: "POST",
          body: JSON.stringify({ url: blob.url, kind }),
        });
        current = { ...current, media: [...current.media, media] };
        onSaved(current);
      }
    } catch (e) {
      toast((e as Error).message || "Yuklashda xatolik");
    } finally {
      setProgress("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeMedia(m: Media) {
    if (!(await confirmDialog("Bu fayl o'chirilsinmi?"))) return;
    try {
      await api(`/api/spots/${spot.id}/media?mediaId=${m.id}`, { method: "DELETE" });
      onSaved({ ...spot, media: spot.media.filter((x) => x.id !== m.id) });
      setViewer(null);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const chosen = [fishMost, fishMid, fishLeast];
  const fishSelect = (icon: string, label: string, value: string, set: (v: string) => void) => (
    <label className="row">
      <span className="rowLabel">
        {icon} {label}
      </span>
      <select value={value} onChange={(e) => set(e.target.value)} className={value ? "" : "needs"}>
        <option value="">Tanlang</option>
        <option value={NONE}>{NONE}</option>
        {FISH.map((f) => (
          <option key={f} value={f} disabled={f !== value && chosen.includes(f)}>
            {f}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="sheet">
      <div className="grab" aria-hidden="true" />
      <div className="sheetHead">
        <input
          className="nameInput"
          value={name}
          placeholder={isNew ? "Yangi joy" : `Joy #${spot.id}`}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="iconBtn" onClick={onClose} aria-label="Yopish">
          ✕
        </button>
      </div>

      <div className="coords">
        <span>
          📍 {spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}
        </span>
      </div>

      {!isNew && (
        <div className="quick">
          <button className="ghost" onClick={() => setDir(true)}>
            🧭 Qanday boriladi
          </button>
          <button className="ghost" onClick={share}>
            📤 Ulashish
          </button>
        </div>
      )}

      <div className="section">
        <h3>🐟 Qaysi baliq ko'proq? (majburiy)</h3>
        <p className="hint hintTop">Baliq deyarli bo'lmasa, "Yo'q" ni tanlang.</p>
        {fishSelect("🥇", "Eng ko'p", fishMost, setFishMost)}
        {fishSelect("🥈", "O'rtacha", fishMid, setFishMid)}
        {fishSelect("🥉", "Eng kam", fishLeast, setFishLeast)}
        {!fishValid && <p className="req">Uchala qatorni ham tanlang. Baliq turlari takrorlanmasligi kerak ("Yo'q" takrorlanishi mumkin).</p>}
      </div>

      <div className="section">
        <h3>🪱 Qanday yem olish kerak?</h3>
        <textarea
          rows={2}
          value={bait}
          maxLength={500}
          placeholder="Masalan: makkajo'xori, qurt, boyli..."
          onChange={(e) => setBait(e.target.value)}
        />
      </div>

      <div className="section">
        <h3>🕒 Kunning qaysi qismida yaxshi?</h3>
        <div className="chips">
          {TIMES.map((t) => (
            <button key={t} className={`chip ${times.includes(t) ? "chipOn" : ""}`} onClick={() => toggleTime(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <h3>📝 Izoh</h3>
        <textarea
          rows={4}
          value={note}
          maxLength={3000}
          placeholder="Keyingi mavsum uchun eslatma: qanday yetib borish, chuqurlik, qirg'oq, ..."
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="section">
        <h3>📷 Rasm va videolar</h3>
        {isNew ? (
          <p className="hint">Rasm va video joy saqlangandan keyin qo'shiladi.</p>
        ) : (
          <>
            <div className="mediaGrid">
              {spot.media.map((m) => (
                <button key={m.id} className="thumb" onClick={() => setViewer(m)}>
                  {m.kind === "video" ? (
                    <>
                      <video src={`${m.url}#t=0.1`} preload="metadata" muted playsInline />
                      <span className="play">▶</span>
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="" loading="lazy" />
                  )}
                </button>
              ))}
              <button className="thumb addThumb" onClick={() => fileRef.current?.click()} disabled={!!progress}>
                {progress ? progress : "＋"}
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(e) => onFiles(e.target.files)}
            />
          </>
        )}
      </div>

      <div className="section">
        <label className="row">
          <span className="rowLabel">🧭 Viloyat</span>
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">{isNew ? "Avto-aniqlash" : "Aniqlanmagan"}</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            <option value={OTHER_REGION}>{OTHER_REGION}</option>
          </select>
        </label>
      </div>

      <div className="actions">
        <button className="primary" onClick={save} disabled={saving || !fishValid}>
          {saving ? "Saqlanmoqda..." : isNew ? "Joyni saqlash" : "Saqlash"}
        </button>
        {!isNew && (
          <button className="danger" onClick={remove}>
            🗑 O'chirish
          </button>
        )}
      </div>

      {!isNew && <Comments spotId={spot.id} isOwner toast={toast} />}

      {dir && <Directions lat={spot.lat} lng={spot.lng} title={name.trim() || undefined} onClose={() => setDir(false)} />}

      {viewer && (
        <div className="viewer" onClick={() => setViewer(null)}>
          <div className="viewerInner" onClick={(e) => e.stopPropagation()}>
            {viewer.kind === "video" ? (
              <video src={viewer.url} controls autoPlay playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewer.url} alt="" />
            )}
            <div className="viewerBar">
              <button className="danger" onClick={() => removeMedia(viewer)}>
                🗑 O'chirish
              </button>
              <button className="primary" onClick={() => setViewer(null)}>
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
