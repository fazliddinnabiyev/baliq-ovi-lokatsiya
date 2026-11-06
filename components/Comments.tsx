"use client";

import { useCallback, useEffect, useState } from "react";
import { api, confirmDialog } from "@/lib/client";
import type { Comment } from "@/lib/types";

const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

function when(iso: string): string {
  const d = new Date(iso);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${hm}`;
}

type Props = { spotId: number; isOwner: boolean; toast: (m: string) => void; onCount?: (n: number) => void };

/** Instagram uslubidagi kommentlar: kim yozgani ko'rinib turadi. */
export default function Comments({ spotId, isOwner, toast, onCount }: Props) {
  const [items, setItems] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const set = useCallback(
    (list: Comment[]) => {
      setItems(list);
      onCount?.(list.length);
    },
    [onCount]
  );

  useEffect(() => {
    let off = false;
    api<Comment[]>(`/api/spots/${spotId}/comments`)
      .then((l) => !off && set(l))
      .catch(() => !off && setItems([]));
    return () => {
      off = true;
    };
  }, [spotId, set]);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      set(await api<Comment[]>(`/api/spots/${spotId}/comments`, { method: "POST", body: JSON.stringify({ text: t }) }));
      setText("");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function remove(c: Comment) {
    if (!(await confirmDialog("Komment o'chirilsinmi?"))) return;
    try {
      await api(`/api/spots/${spotId}/comments?commentId=${c.id}`, { method: "DELETE" });
      set((items ?? []).filter((x) => x.id !== c.id));
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <div className="section">
      <h3>💬 Kommentlar {items && items.length > 0 ? `(${items.length})` : ""}</h3>
      {items === null && <p className="hint">Yuklanmoqda...</p>}
      {items && items.length === 0 && <p className="hint">Hali komment yo'q. Birinchi bo'lib yozing.</p>}
      <div className="comments">
        {(items ?? []).map((c) => (
          <div key={c.id} className="comment">
            <span className="avatar" aria-hidden="true">
              {c.userName.slice(0, 1).toUpperCase()}
            </span>
            <div className="cBody">
              <div>
                <b>{c.userName}</b>
                {c.byOwner && <span className="ownerTag">muallif</span>}
                <span className="cTime">{when(c.createdAt)}</span>
              </div>
              <p>{c.text}</p>
            </div>
            {(c.mine || isOwner) && (
              <button className="cDel" onClick={() => remove(c)} aria-label="Kommentni o'chirish">
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="cForm">
        <input
          value={text}
          maxLength={500}
          placeholder="Komment yozing..."
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="primary" onClick={send} disabled={sending || !text.trim()}>
          Yuborish
        </button>
      </div>
    </div>
  );
}
