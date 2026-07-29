"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/Modal";
import Icon from "@/components/Icon";
import { addDriverAction, updateDriverAction } from "@/lib/actions";
import type { Park } from "@/lib/types";

export interface DriverFormValues {
  id: string;
  name: string;
  phone: string;
  parkId: string | null;
  licenseNo: string;
  passport: string;
  address: string;
  deposit: number;
  comment: string;
  active: boolean;
}

const empty = (parkId: string) => ({
  fullName: "", phone: "", parkId,
  licenseNo: "", passport: "", address: "", deposit: "", comment: "",
  active: true,
});

export default function DriverFormButton({
  parks,
  driver,
  label,
  variant = "primary",
}: {
  parks: Park[];
  driver?: DriverFormValues;
  label?: string;
  variant?: "primary" | "icon";
}) {
  const isEdit = !!driver;
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [f, setF] = useState(() => empty(parks[0]?.id ?? ""));
  const set = (k: keyof ReturnType<typeof empty>, v: string | boolean) =>
    setF((s) => ({ ...s, [k]: v }));

  function openForm() {
    setF(
      driver
        ? {
            fullName: driver.name,
            phone: driver.phone,
            parkId: driver.parkId ?? parks[0]?.id ?? "",
            licenseNo: driver.licenseNo,
            passport: driver.passport,
            address: driver.address,
            deposit: driver.deposit ? String(driver.deposit) : "",
            comment: driver.comment,
            active: driver.active,
          }
        : empty(parks[0]?.id ?? "")
    );
    setErr("");
    setOpen(true);
  }

  function submit() {
    if (!f.fullName.trim()) {
      setErr("Укажите ФИО водителя");
      return;
    }
    setErr("");
    const payload = {
      fullName: f.fullName,
      phone: f.phone,
      parkId: f.parkId,
      licenseNo: f.licenseNo,
      passport: f.passport,
      address: f.address,
      deposit: Number(f.deposit) || 0,
      comment: f.comment,
      active: f.active,
    };
    start(async () => {
      try {
        if (isEdit) await updateDriverAction(driver!.id, payload);
        else await addDriverAction(payload);
        setOpen(false);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Не удалось сохранить");
      }
    });
  }

  return (
    <>
      {variant === "icon" ? (
        <button className="icon-btn" title="Редактировать водителя" onClick={openForm}>
          <Icon name="file" size={14} />
        </button>
      ) : (
        <button className="btn" onClick={openForm}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span>
          {label ?? "Добавить водителя"}
        </button>
      )}

      {open && (
        <Modal
          title={isEdit ? "Редактирование водителя" : "Новый водитель"}
          subtitle="Обязательно только ФИО — остальное можно заполнить позже"
          onClose={() => setOpen(false)}
        >
          <div className="form-grid">
            <div className="field full">
              <label>ФИО *</label>
              <input value={f.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Иванов Иван Иванович" />
            </div>
            <div className="field">
              <label>Телефон</label>
              <input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+7 900 000-00-00" />
            </div>
            <div className="field">
              <label>Автопарк</label>
              <select value={f.parkId} onChange={(e) => set("parkId", e.target.value)}>
                {parks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Водительское удостоверение</label>
              <input value={f.licenseNo} onChange={(e) => set("licenseNo", e.target.value)} placeholder="99 99 123456" />
            </div>
            <div className="field">
              <label>Паспорт</label>
              <input value={f.passport} onChange={(e) => set("passport", e.target.value)} placeholder="0000 000000" />
            </div>
            <div className="field full">
              <label>Адрес регистрации</label>
              <input value={f.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="field">
              <label>Залог, ₽</label>
              <input type="number" value={f.deposit} onChange={(e) => set("deposit", e.target.value)} placeholder="0" />
            </div>
            <div className="field">
              <label>Статус</label>
              <select value={f.active ? "1" : "0"} onChange={(e) => set("active", e.target.value === "1")}>
                <option value="1">Активен</option>
                <option value="0">Неактивен</option>
              </select>
            </div>
            <div className="field full">
              <label>Комментарий</label>
              <textarea rows={2} value={f.comment} onChange={(e) => set("comment", e.target.value)} />
            </div>
          </div>

          {err && <div className="form-err">{err}</div>}

          <div className="form-actions">
            <button className="btn ghost" onClick={() => setOpen(false)}>Отмена</button>
            <button className="btn" disabled={pending} onClick={submit}>
              {pending ? "Сохранение…" : isEdit ? "Сохранить изменения" : "Сохранить водителя"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
