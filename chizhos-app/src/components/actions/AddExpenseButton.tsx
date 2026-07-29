"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/Modal";
import { addExpenseAction } from "@/lib/actions";
import { isoDate } from "@/lib/format";
import { EXPENSE_CATS, type ExpenseCat } from "@/lib/types";

const CATS = Object.keys(EXPENSE_CATS) as ExpenseCat[];

export interface CarOption {
  id: string;
  plate: string;
  brand: string;
  model: string;
}

export default function AddExpenseButton({
  cars,
  parks,
  isAdmin,
  label,
}: {
  cars: CarOption[];
  parks: { id: string; name: string }[];
  isAdmin: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [f, setF] = useState({
    cat: "to" as ExpenseCat,
    amount: "",
    date: isoDate(),
    // По умолчанию — общий расход; если авто в системе одно, удобнее выбрать его.
    carId: cars.length === 1 ? cars[0].id : "",
    parkId: "",
    name: "",
    comment: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  function submit() {
    const amount = Number(f.amount);
    if (!amount || amount <= 0) {
      setErr("Укажите сумму расхода");
      return;
    }
    setErr("");
    start(async () => {
      try {
        await addExpenseAction({
          cat: f.cat,
          amount,
          date: f.date,
          carId: f.carId || null,
          parkId: f.carId ? null : f.parkId || null,
          name: f.name,
          comment: f.comment,
        });
        setF((s) => ({ ...s, amount: "", name: "", comment: "" }));
        setOpen(false);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Не удалось сохранить расход");
      }
    });
  }

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        <span style={{ fontSize: 15, lineHeight: 1 }}>＋</span> {label ?? "Добавить расход"}
      </button>

      {open && (
        <Modal
          title="Новый расход"
          subtitle="Привяжите к автомобилю или оставьте общим — показатели пересчитаются сразу"
          onClose={() => setOpen(false)}
        >
          <div className="form-grid">
            <div className="field">
              <label>Категория *</label>
              <select value={f.cat} onChange={(e) => set("cat", e.target.value)}>
                {CATS.map((k) => <option key={k} value={k}>{EXPENSE_CATS[k]}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Сумма, ₽ *</label>
              <input type="number" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0" autoFocus />
            </div>
            <div className="field">
              <label>Дата *</label>
              <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="field">
              <label>Автомобиль</label>
              <select value={f.carId} onChange={(e) => set("carId", e.target.value)}>
                <option value="">— общий расход (без авто) —</option>
                {cars.map((c) => (
                  <option key={c.id} value={c.id}>{c.plate} — {c.brand} {c.model}</option>
                ))}
              </select>
              {cars.length === 0 && (
                <span className="field-hint">Автомобилей пока нет — расход будет общим</span>
              )}
            </div>

            {/* Общий расход администратор может отнести на конкретный парк
                либо оставить общефирменным. */}
            {isAdmin && !f.carId && (
              <div className="field">
                <label>Отнести на парк</label>
                <select value={f.parkId} onChange={(e) => set("parkId", e.target.value)}>
                  <option value="">— на всю компанию —</option>
                  {parks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            <div className="field full">
              <label>Наименование / описание</label>
              <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Напр. Замена масла" />
              <span className="field-hint">Если не заполнить — подставится название категории</span>
            </div>
            <div className="field full">
              <label>Комментарий</label>
              <input value={f.comment} onChange={(e) => set("comment", e.target.value)} placeholder="необязательно" />
            </div>
          </div>

          {err && <div className="form-err">{err}</div>}

          <div className="form-actions">
            <button className="btn ghost" onClick={() => setOpen(false)}>Отмена</button>
            <button className="btn" disabled={pending} onClick={submit}>
              {pending ? "Сохранение…" : "Сохранить расход"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
