"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/Modal";
import { addPaymentAction } from "@/lib/actions";
import { isoDate } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/types";

/**
 * Начисление платежа по аренде.
 * Платежи не генерируются автоматически — каждый вносится вручную
 * либо начислением за период, либо как разовый.
 */
export default function AddPaymentButton({
  carId,
  defaultAmount,
}: {
  carId: string;
  defaultAmount: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [f, setF] = useState({
    date: isoDate(),
    amount: defaultAmount ? String(defaultAmount) : "",
    paid: "true",
    method: PAYMENT_METHODS[1] as string,
    comment: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  function submit() {
    const amount = Number(f.amount);
    if (!amount || amount <= 0) {
      setErr("Укажите сумму платежа");
      return;
    }
    setErr("");
    start(async () => {
      try {
        await addPaymentAction({
          carId,
          date: f.date,
          amount,
          paid: f.paid === "true",
          method: f.method,
          comment: f.comment,
        });
        setF((s) => ({ ...s, comment: "" }));
        setOpen(false);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Не удалось сохранить платёж");
      }
    });
  }

  return (
    <>
      <button className="btn" style={{ padding: "6px 12px" }} onClick={() => setOpen(true)}>
        <span style={{ fontSize: 15, lineHeight: 1 }}>＋</span> Внести платёж
      </button>

      {open && (
        <Modal
          title="Платёж по аренде"
          subtitle="Начисление за конкретный день. Неоплаченные платежи формируют задолженность."
          onClose={() => setOpen(false)}
        >
          <div className="form-grid">
            <div className="field">
              <label>Дата платежа *</label>
              <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="field">
              <label>Сумма, ₽ *</label>
              <input type="number" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0" />
            </div>
            <div className="field">
              <label>Статус</label>
              <select value={f.paid} onChange={(e) => set("paid", e.target.value)}>
                <option value="true">Оплачен</option>
                <option value="false">Не оплачен (задолженность)</option>
              </select>
            </div>
            <div className="field">
              <label>Способ оплаты</label>
              <select value={f.method} onChange={(e) => set("method", e.target.value)}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
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
              {pending ? "Сохранение…" : "Сохранить платёж"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
