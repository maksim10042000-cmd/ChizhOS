"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { rub } from "@/lib/format";
import { setManagerPercentAction } from "@/lib/actions";
import { formatPercent } from "@/components/PercentBadge";

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Процент управляющего по автопарку.
 *
 * Поле — значение ПО УМОЛЧАНИЮ: оно применяется к автомобилям, у которых
 * не задан собственный процент. Итоговая выплата считается по каждому
 * автомобилю отдельно, поэтому она не равна «доход × общий процент»,
 * если у части машин проценты индивидуальные.
 */
export default function ManagerCard({
  incMonth,
  profit,
  globalPercent,
  managerPay,
  ownerProfit,
  carsWithOwnPercent,
  totalCars,
  canEdit,
}: {
  incMonth: number;
  profit: number;
  globalPercent: number;
  managerPay: number;
  ownerProfit: number;
  carsWithOwnPercent: number;
  totalCars: number;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(String(globalPercent).replace(".", ","));
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Значение с сервера побеждает: после пересчёта показываем сохранённое.
  useEffect(() => {
    setValue(String(globalPercent).replace(".", ","));
  }, [globalPercent]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function save(raw: string) {
    // Запятая — привычный десятичный разделитель, принимаем оба варианта.
    const n = Number(raw.replace(",", "."));
    if (raw.trim() === "" || !Number.isFinite(n)) {
      setState("error");
      setError("Введите число");
      return;
    }
    if (n < 0 || n > 100) {
      setState("error");
      setError("Допустимы значения от 0 до 100");
      return;
    }
    setError("");
    setState("saving");
    start(async () => {
      try {
        await setManagerPercentAction(n);
        setState("saved");
      } catch (e) {
        setState("error");
        setError(e instanceof Error ? e.message : "Не удалось сохранить");
      }
    });
  }

  /** Автосохранение: через паузу после ввода, не дожидаясь ухода из поля. */
  function onChange(raw: string) {
    setValue(raw);
    setState("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(raw), 700);
  }

  const inherited = totalCars - carsWithOwnPercent;

  return (
    <div className="card">
      <div className="card-title">
        Процент управляющего
        <span className="muted" style={{ fontWeight: 500 }}>
          расчёт обновляется автоматически
        </span>
      </div>

      <div className="grid manager-grid">
        <div className="field">
          <label htmlFor="global-percent">Процент по умолчанию, %</label>
          <input
            id="global-percent"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.5}
            value={value}
            disabled={!canEdit}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => {
              if (timer.current) clearTimeout(timer.current);
              save(e.target.value);
            }}
          />
          <span className="field-hint">
            {canEdit ? (
              <>
                Применяется к автомобилям без собственного процента. Допустимы дробные
                значения, например 8,5.
                {state === "saving" && <b className="save-note"> Сохранение…</b>}
                {state === "saved" && <b className="save-note ok"> Сохранено</b>}
                {state === "error" && <b className="save-note err"> {error}</b>}
              </>
            ) : (
              "Изменить может администратор"
            )}
          </span>
        </div>

        <div className="mini-metric">
          <div className="mk">Выручка за месяц</div>
          <div className="mv">{rub(incMonth)}</div>
        </div>

        <div className="mini-metric" style={{ background: "var(--amber-soft)", borderColor: "#f6e2bf" }}>
          <div className="mk">Выплата управляющему</div>
          <div className="mv" style={{ color: "var(--amber)" }}>{rub(managerPay)}</div>
        </div>

        <div className="mini-metric" style={{ background: "var(--green-soft)", borderColor: "#c9efd7" }}>
          <div className="mk">Прибыль владельца</div>
          <div className="mv" style={{ color: "var(--green)" }}>{rub(ownerProfit)}</div>
        </div>
      </div>

      <div className="muted manager-note">
        {carsWithOwnPercent > 0 ? (
          <>
            У {carsWithOwnPercent} из {totalCars} автомобилей задан индивидуальный процент
            {inherited > 0 && <>, ещё {inherited} — по общему {formatPercent(globalPercent)}%</>}.
            Выплата считается по каждому автомобилю отдельно.{" "}
            <Link href="/dashboard/cars" className="link">Настроить проценты</Link>
          </>
        ) : (
          <>
            Все автомобили используют общий процент {formatPercent(globalPercent)}%.
            Индивидуальный процент задаётся в карточке автомобиля или массово в{" "}
            <Link href="/dashboard/cars" className="link">списке автомобилей</Link>.
          </>
        )}
        {" "}Чистая прибыль до выплаты — {rub(profit)}.
      </div>
    </div>
  );
}
