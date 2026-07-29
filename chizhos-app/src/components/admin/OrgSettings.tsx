"use client";

import { useState, useTransition } from "react";
import { setOrgNameAction, setManagerPercentAction } from "@/lib/actions";

export default function OrgSettings({
  orgName,
  managerPercent,
}: {
  orgName: string;
  managerPercent: number;
}) {
  const [name, setName] = useState(orgName);
  const [percent, setPercent] = useState(String(managerPercent));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setMsg(null);
    start(async () => {
      try {
        if (name.trim() !== orgName) await setOrgNameAction(name);
        const p = Number(percent);
        if (Number.isFinite(p) && p !== managerPercent) await setManagerPercentAction(p);
        setMsg({ ok: true, text: "Настройки сохранены" });
      } catch (e) {
        setMsg({ ok: false, text: e instanceof Error ? e.message : "Не удалось сохранить" });
      }
    });
  }

  return (
    <div className="card">
      <div className="card-title">Организация</div>

      <div className="field" style={{ marginBottom: 14 }}>
        <label>Название организации</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ООО «Ромашка»" />
        <span className="field-hint">Показывается в боковом меню и на странице входа</span>
      </div>

      <div className="field">
        <label>Процент управляющего, %</label>
        <input
          type="number"
          min={0}
          max={100}
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
        />
        <span className="field-hint">Используется в расчёте на странице «Финансы»</span>
      </div>

      <div style={{ marginTop: 16 }}>
        <button className="btn" disabled={pending} onClick={save}>
          {pending ? "Сохранение…" : "Сохранить"}
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
