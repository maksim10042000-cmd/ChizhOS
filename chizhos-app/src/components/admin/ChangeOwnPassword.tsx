"use client";

import { useState, useTransition } from "react";
import { changeOwnPasswordAction } from "@/lib/actions";

export default function ChangeOwnPassword({ login }: { login: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    if (next.length < 6) {
      setMsg({ ok: false, text: "Новый пароль должен быть не короче 6 символов" });
      return;
    }
    if (next !== repeat) {
      setMsg({ ok: false, text: "Новые пароли не совпадают" });
      return;
    }
    setMsg(null);
    start(async () => {
      try {
        await changeOwnPasswordAction(current, next);
        setCurrent("");
        setNext("");
        setRepeat("");
        setMsg({ ok: true, text: "Пароль изменён" });
      } catch (e) {
        setMsg({ ok: false, text: e instanceof Error ? e.message : "Не удалось сменить пароль" });
      }
    });
  }

  return (
    <div className="card">
      <div className="card-title">Мой пароль ({login})</div>
      <div className="form-grid">
        <div className="field full">
          <label>Текущий пароль</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </div>
        <div className="field">
          <label>Новый пароль</label>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="field">
          <label>Повторите новый</label>
          <input type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <button className="btn" disabled={pending} onClick={submit}>
          {pending ? "Сохранение…" : "Сменить пароль"}
        </button>
      </div>

      {msg && (
        <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: msg.ok ? "var(--green)" : "var(--red)" }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
