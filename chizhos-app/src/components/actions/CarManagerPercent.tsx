"use client";

import { useEffect, useState, useTransition } from "react";
import PercentBadge, { formatPercent } from "@/components/PercentBadge";
import { setCarManagerPercentAction } from "@/lib/actions";
import { rub } from "@/lib/format";
import type { CarFinance } from "@/lib/types";

/**
 * Финансовые настройки автомобиля: индивидуальный процент управляющего.
 *
 * Пустое поле означает «не задан» — автомобиль берёт общий процент автопарка.
 * Именно так реализовано наследование: значение либо своё, либо общее.
 */
export default function CarManagerPercent({
  carId,
  ownPercent,
  globalPercent,
  fin,
  canEdit,
}: {
  carId: string;
  /** null — индивидуальный процент не задан. */
  ownPercent: number | null;
  globalPercent: number;
  fin: CarFinance;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(ownPercent == null ? "" : String(ownPercent).replace(".", ","));
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  // После пересчёта на сервере подтягиваем сохранённое значение.
  useEffect(() => {
    setValue(ownPercent == null ? "" : String(ownPercent).replace(".", ","));
  }, [ownPercent]);

  function submit(next: string) {
    const raw = next.trim();
    setSaved(false);

    // Пустая строка = снять индивидуальный процент.
    if (raw === "") {
      apply(null);
      return;
    }
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) {
      setErr("Введите число");
      return;
    }
    if (n < 0 || n > 100) {
      setErr("Допустимы значения от 0 до 100");
      return;
    }
    apply(n);
  }

  function apply(percent: number | null) {
    setErr("");
    start(async () => {
      try {
        await setCarManagerPercentAction(carId, percent);
        setSaved(true);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Не удалось сохранить");
      }
    });
  }

  return (
    <div className="card">
      <div className="card-title">
        Финансовые настройки
        <PercentBadge source={fin.managerPercentSource} />
      </div>

      <div className="grid car-percent-grid">
        <div className="field">
          <label htmlFor={`pct-${carId}`}>Процент управляющего, %</label>
          <input
            id={`pct-${carId}`}
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.5}
            value={value}
            disabled={!canEdit || pending}
            placeholder={`${formatPercent(globalPercent)} — общий`}
            onChange={(e) => { setValue(e.target.value); setErr(""); setSaved(false); }}
            onBlur={(e) => submit(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          />
          <span className="field-hint">
            {canEdit
              ? "Оставьте поле пустым, чтобы использовать общий процент автопарка"
              : "Изменение доступно администратору и менеджеру парка"}
            {pending && <b className="save-note"> Сохранение…</b>}
            {saved && !pending && <b className="save-note ok"> Сохранено</b>}
          </span>
        </div>

        <div className="mini-metric">
          <div className="mk">Действующий процент</div>
          <div className="mv">{formatPercent(fin.managerPercent)}%</div>
        </div>

        <div className="mini-metric" style={{ background: "var(--amber-soft)", borderColor: "#f6e2bf" }}>
          <div className="mk">Управляющему за месяц</div>
          <div className="mv" style={{ color: "var(--amber)" }}>{rub(fin.managerPayMonth)}</div>
        </div>

        <div className="mini-metric" style={{ background: "var(--green-soft)", borderColor: "#c9efd7" }}>
          <div className="mk">Владельцу за месяц</div>
          <div className="mv" style={{ color: "var(--green)" }}>{rub(fin.ownerProfitMonth)}</div>
        </div>
      </div>

      {canEdit && ownPercent != null && (
        <button
          className="btn ghost"
          style={{ marginTop: 14 }}
          disabled={pending}
          onClick={() => { setValue(""); apply(null); }}
        >
          Вернуть общий процент ({formatPercent(globalPercent)}%)
        </button>
      )}

      {err && <div className="form-err">{err}</div>}
    </div>
  );
}
