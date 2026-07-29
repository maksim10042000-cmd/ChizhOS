"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/Modal";
import { setUserPasswordAction } from "@/lib/actions";
import type { AppUser } from "@/lib/types";

export default function PasswordForm({
  user,
  onClose,
}: {
  user: AppUser;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    if (password.length < 6) {
      setErr("Пароль должен быть не короче 6 символов");
      return;
    }
    if (password !== repeat) {
      setErr("Пароли не совпадают");
      return;
    }
    setErr("");
    start(async () => {
      try {
        await setUserPasswordAction(user.id, password);
        onClose();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Не удалось сменить пароль");
      }
    });
  }

  return (
    <Modal
      title={`Смена пароля: ${user.login}`}
      subtitle="После смены пароля пользователь будет разлогинен на всех устройствах"
      onClose={onClose}
    >
      <div className="form-grid">
        <div className="field">
          <label>Новый пароль *</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="не короче 6 символов"
            autoComplete="new-password"
            autoFocus
          />
        </div>
        <div className="field">
          <label>Повторите пароль *</label>
          <input
            type="text"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            autoComplete="new-password"
          />
        </div>
      </div>

      {err && <div className="form-err">{err}</div>}

      <div className="form-actions">
        <button className="btn ghost" onClick={onClose}>Отмена</button>
        <button className="btn" disabled={pending} onClick={submit}>
          {pending ? "Сохранение…" : "Сменить пароль"}
        </button>
      </div>
    </Modal>
  );
}
