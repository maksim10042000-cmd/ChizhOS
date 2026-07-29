"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/Modal";
import { formatPercent } from "@/components/PercentBadge";
import { setCarsManagerPercentAction, applyManagerPercentToAllAction } from "@/lib/actions";

type Mode = "set" | "clear";

/**
 * Массовое изменение процента управляющего.
 *
 * Две области действия: выбранные в списке автомобили и весь доступный автопарк.
 * Обе подтверждаются перед применением, потому что затрагивают много записей.
 */
export default function BulkPercentButton({
  selectedIds,
  totalCars,
  globalPercent,
  onDone,
}: {
  selectedIds: string[];
  totalCars: number;
  globalPercent: number;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("set");
  const [value, setValue] = useState(String(globalPercent).replace(".", ","));
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const selectedCount = selectedIds.length;

  /** null — снять индивидуальный процент; число — установить. */
  function resolvePercent(): number | null | undefined {
    if (mode === "clear") return null;
    const n = Number(value.replace(",", "."));
    if (value.trim() === "" || !Number.isFinite(n)) {
      setErr("Введите процент");
      return undefined;
    }
    if (n < 0 || n > 100) {
      setErr("Допустимы значения от 0 до 100");
      return undefined;
    }
    return n;
  }

  function describe(percent: number | null): string {
    return percent === null
      ? `вернуть общий процент автопарка (${formatPercent(globalPercent)}%)`
      : `установить процент ${formatPercent(percent)}%`;
  }

  function applyToSelected() {
    const percent = resolvePercent();
    if (percent === undefined) return;
    if (!window.confirm(`Для выбранных автомобилей (${selectedCount}) — ${describe(percent)}?`)) return;

    setErr("");
    setMsg("");
    start(async () => {
      try {
        const res = await setCarsManagerPercentAction(selectedIds, percent);
        setMsg(`Изменено автомобилей: ${res.updated}`);
        onDone();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Не удалось применить");
      }
    });
  }

  function applyToAll() {
    const percent = resolvePercent();
    if (percent === undefined) return;
    if (
      !window.confirm(
        `Применить ко ВСЕМ автомобилям (${totalCars}) — ${describe(percent)}?\n\n` +
          "Индивидуальные проценты, заданные ранее, будут перезаписаны."
      )
    ) {
      return;
    }

    setErr("");
    setMsg("");
    start(async () => {
      try {
        const res = await applyManagerPercentToAllAction(percent);
        setMsg(`Изменено автомобилей: ${res.updated}`);
        onDone();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Не удалось применить");
      }
    });
  }

  return (
    <>
      <button className="btn ghost" onClick={() => { setOpen(true); setErr(""); setMsg(""); }}>
        Изменить процент управляющего
        {selectedCount > 0 && <span className="chip b" style={{ marginLeft: 6 }}>{selectedCount}</span>}
      </button>

      {open && (
        <Modal
          title="Процент управляющего"
          subtitle="Массовое изменение для выбранных автомобилей или для всего автопарка"
          onClose={() => setOpen(false)}
        >
          <div className="seg">
            <button
              className={"seg-btn" + (mode === "set" ? " on" : "")}
              onClick={() => { setMode("set"); setErr(""); }}
            >
              Установить процент
            </button>
            <button
              className={"seg-btn" + (mode === "clear" ? " on" : "")}
              onClick={() => { setMode("clear"); setErr(""); }}
            >
              Вернуть общий процент
            </button>
          </div>

          {mode === "set" ? (
            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="bulk-percent">Процент, %</label>
              <input
                id="bulk-percent"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={0.5}
                value={value}
                onChange={(e) => { setValue(e.target.value); setErr(""); }}
                autoFocus
              />
              <span className="field-hint">Допустимы дробные значения, например 8,5</span>
            </div>
          ) : (
            <div className="notice" style={{ marginTop: 16 }}>
              Индивидуальный процент будет снят — автомобили начнут использовать общий
              процент автопарка ({formatPercent(globalPercent)}%).
            </div>
          )}

          {err && <div className="form-err">{err}</div>}
          {msg && (
            <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: "var(--green)" }}>
              {msg}
            </div>
          )}

          <div className="bulk-actions">
            <button
              className="btn"
              disabled={pending || selectedCount === 0}
              onClick={applyToSelected}
              title={selectedCount === 0 ? "Отметьте автомобили в списке галочками" : undefined}
            >
              {pending ? "Применение…" : `Применить к выбранным (${selectedCount})`}
            </button>
            <button className="btn ghost" disabled={pending} onClick={applyToAll}>
              Применить ко всем автомобилям ({totalCars})
            </button>
            <button className="btn ghost" onClick={() => setOpen(false)}>Закрыть</button>
          </div>
        </Modal>
      )}
    </>
  );
}
