"use client";

import { useRef, useState, useTransition } from "react";
import Icon from "@/components/Icon";
import { addDocAction, replaceDocAction, deleteDocAction } from "@/lib/actions";
import type { Doc, DocKind } from "@/lib/types";

const fmtSize = (n?: number) =>
  !n ? "" : n < 1024 ? n + " Б" : n < 1048576 ? (n / 1024).toFixed(0) + " КБ" : (n / 1048576).toFixed(1) + " МБ";

async function upload(file: File): Promise<{ url: string; name: string; mime: string; size: number }> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || "Ошибка загрузки");
  }
  return r.json();
}

export default function DocSection({
  carId,
  kind,
  title,
  docs,
  types,
  disabled,
  disabledHint,
}: {
  carId: string;
  kind: DocKind;
  title: string;
  docs?: Doc[];
  types?: string[];
  disabled?: boolean;
  disabledHint?: string;
}) {
  const addRef = useRef<HTMLInputElement>(null);
  const repRef = useRef<HTMLInputElement>(null);
  const repId = useRef<string | null>(null);
  const [type, setType] = useState(types ? types[0] : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const list = docs ?? [];
  const accept = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,image/*,application/pdf";

  async function onAdd(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    setErr("");
    try {
      for (const file of Array.from(files)) {
        const s = await upload(file);
        await addDocAction(carId, kind, {
          name: s.name,
          url: s.url,
          mime: s.mime,
          size: s.size,
          docType: types ? type : undefined,
        });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    }
    setBusy(false);
  }

  async function onReplace(files: FileList | null) {
    if (!files || !files.length || !repId.current) return;
    setBusy(true);
    setErr("");
    try {
      const s = await upload(files[0]);
      await replaceDocAction(repId.current, { name: s.name, url: s.url, mime: s.mime, size: s.size });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    }
    setBusy(false);
    repId.current = null;
  }

  return (
    <div>
      <div className="sec-h">
        {title}
        {!disabled && types && (
          <select className="doc-type-sel" value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {!disabled && (
          <button
            className="btn"
            style={{ padding: "6px 12px" }}
            disabled={busy}
            onClick={() => addRef.current?.click()}
          >
            <Icon name="upload" size={14} color="#fff" />
            {busy ? "Загрузка…" : "Загрузить"}
          </button>
        )}
      </div>

      <input ref={addRef} type="file" multiple accept={accept} style={{ display: "none" }}
        onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }} />
      <input ref={repRef} type="file" accept={accept} style={{ display: "none" }}
        onChange={(e) => { onReplace(e.target.files); e.target.value = ""; }} />

      {err && <div className="form-err" style={{ marginTop: 0, marginBottom: 10 }}>{err}</div>}

      {disabled ? (
        <div className="doc-empty">{disabledHint ?? "Загрузка документов недоступна"}</div>
      ) : list.length === 0 ? (
        <div className="doc-empty">Документы не прикреплены — нажмите «Загрузить»</div>
      ) : (
        <div className="doc-list">
          {list.map((d) => (
            <div className="doc-row" key={d.id}>
              <div className="doc-ico"><Icon name="file" size={17} /></div>
              <div style={{ minWidth: 0 }}>
                <div className="doc-name">
                  {d.name}
                  {d.docType && <span className="doc-type">{d.docType}</span>}
                </div>
                <div className="muted" style={{ fontSize: 11.5 }}>
                  {new Date(d.uploadedAt).toLocaleDateString("ru-RU")}
                  {d.size ? " • " + fmtSize(d.size) : ""}
                </div>
              </div>
              <div className="doc-actions">
                <a className="doc-btn" href={d.url} download={d.name} target="_blank" rel="noopener noreferrer">Скачать</a>
                <button className="doc-btn" disabled={busy}
                  onClick={() => { repId.current = d.id; repRef.current?.click(); }}>
                  Заменить
                </button>
                <button className="doc-btn del" disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Удалить документ «${d.name}»? Действие нельзя отменить.`)) {
                      start(async () => { await deleteDocAction(d.id); });
                    }
                  }}>
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
