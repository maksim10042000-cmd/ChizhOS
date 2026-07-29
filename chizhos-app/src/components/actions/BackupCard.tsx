"use client";

import { useRef, useState, useTransition } from "react";
import { importDataAction } from "@/lib/actions";

export default function BackupCard() {
  const ref = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(files: FileList | null) {
    if (!files || !files.length) return;
    // Восстановление затирает текущее содержимое базы — спрашиваем явно.
    if (
      !window.confirm(
        "Восстановление ПОЛНОСТЬЮ заменит текущие данные: автомобили, водителей, платежи, расходы, документы и пользователей.\n\nПродолжить?"
      )
    ) {
      return;
    }
    const text = await files[0].text();
    setMsg(null);
    start(async () => {
      try {
        await importDataAction(text);
        setMsg({ ok: true, text: "Данные восстановлены из резервной копии." });
      } catch (e) {
        setMsg({ ok: false, text: e instanceof Error ? e.message : "Ошибка импорта" });
      }
    });
  }

  return (
    <div className="card">
      <div className="card-title">Резервное копирование</div>
      <div className="muted" style={{ fontSize: 12.5, marginBottom: 14, lineHeight: 1.6 }}>
        В выгрузку попадают автопарки, автомобили, водители, платежи, расходы, документы,
        пользователи и настройки. Сами файлы документов в JSON не входят — их нужно копировать
        отдельно (папка <code>public/uploads</code> или бакет S3/R2). Подробности — в INSTALL.md.
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a className="btn" href="/api/backup" download>Скачать резервную копию</a>
        <button className="btn ghost" disabled={pending} onClick={() => ref.current?.click()}>
          {pending ? "Восстановление…" : "Восстановить из файла"}
        </button>
        <input
          ref={ref}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={(e) => { onFile(e.target.files); e.target.value = ""; }}
        />
      </div>

      {msg && (
        <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 600, color: msg.ok ? "var(--green)" : "var(--red)" }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
