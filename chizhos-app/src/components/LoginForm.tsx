"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { loginAction } from "@/lib/actions";

export default function LoginForm({ orgName }: { orgName: string }) {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      try {
        const res = await loginAction(login, password);
        if (res.error) {
          setError(res.error);
          return;
        }
        // Куда именно вести пользователя, решает /dashboard по его роли и правам.
        router.replace("/dashboard");
        router.refresh();
      } catch {
        setError("Не удалось войти. Попробуйте ещё раз.");
      }
    });
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="brand" style={{ padding: 0, marginBottom: 20 }}>
          <div className="brand-logo">Ч</div>
          <div>
            <div className="brand-name">ChizhOS</div>
            <div className="brand-sub">{orgName}</div>
          </div>
        </div>

        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
          Вход в систему управления автопарком
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label htmlFor="login">Логин</label>
          <input
            id="login"
            name="login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            placeholder="Ваш логин"
          />
        </div>

        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            placeholder="Ваш пароль"
          />
        </div>

        {error && <div className="form-err">{error}</div>}

        <button className="btn login-submit" type="submit" disabled={pending}>
          {pending ? "Вход…" : "Войти"}
        </button>

        <div className="muted" style={{ fontSize: 11.5, marginTop: 18, textAlign: "center" }}>
          Логин и пароль выдаёт администратор системы.
        </div>
      </form>
    </div>
  );
}
