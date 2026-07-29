"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/Modal";
import { addCarAction, updateCarAction } from "@/lib/actions";
import { isoDate } from "@/lib/format";
import type { CarStatus, DerivedCar, Park } from "@/lib/types";

export interface DriverOption {
  id: string;
  fullName: string;
  parkId: string | null;
}

interface FormState {
  plate: string;
  brand: string;
  model: string;
  year: string;
  parkId: string;
  status: CarStatus;
  driverId: string;
  mileage: string;
  mileMonth: string;
  rate: string;
  insuranceUntil: string;
  nextServiceKm: string;
  managerPercent: string;
}

function emptyForm(parkId: string): FormState {
  return {
    plate: "", brand: "", model: "", year: "", parkId,
    status: "on", driverId: "", mileage: "", mileMonth: "", rate: "",
    insuranceUntil: "", nextServiceKm: "", managerPercent: "",
  };
}

function formFromCar(c: DerivedCar): FormState {
  return {
    plate: c.plate,
    brand: c.brand,
    model: c.model,
    year: c.year ? String(c.year) : "",
    parkId: c.parkId,
    status: c.status,
    driverId: c.driverId ?? "",
    mileage: String(c.mileage),
    mileMonth: String(c.mileMonth),
    rate: String(c.rate),
    // Дата хранится как момент времени, полю нужен формат YYYY-MM-DD.
    insuranceUntil: c.insuranceDays == null
      ? ""
      : isoDate(new Date(Date.now() + c.insuranceDays * 86_400_000)),
    nextServiceKm: c.toRemainingKm == null ? "" : String(c.mileage + c.toRemainingKm),
    managerPercent: c.managerPercent == null ? "" : String(c.managerPercent).replace(".", ","),
  };
}

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export default function CarFormButton({
  parks,
  drivers,
  car,
  label,
  variant = "primary",
}: {
  parks: Park[];
  drivers: DriverOption[];
  car?: DerivedCar;
  label?: string;
  variant?: "primary" | "ghost";
}) {
  const isEdit = !!car;
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [f, setF] = useState<FormState>(() =>
    car ? formFromCar(car) : emptyForm(parks[0]?.id ?? "")
  );
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  // Водителя можно закрепить только из того же парка, что и автомобиль.
  const parkDrivers = drivers.filter((d) => !d.parkId || d.parkId === f.parkId);

  function openForm() {
    setF(car ? formFromCar(car) : emptyForm(parks[0]?.id ?? ""));
    setErr("");
    setOpen(true);
  }

  function submit() {
    if (!f.plate.trim() || !f.brand.trim() || !f.model.trim()) {
      setErr("Заполните госномер, марку и модель");
      return;
    }
    if (!f.parkId) {
      setErr("Выберите автопарк");
      return;
    }
    setErr("");

    const payload = {
      plate: f.plate,
      brand: f.brand,
      model: f.model,
      year: numOrNull(f.year),
      parkId: f.parkId,
      status: f.status,
      driverId: f.driverId || null,
      mileage: Number(f.mileage) || 0,
      mileMonth: Number(f.mileMonth) || 0,
      rate: Number(f.rate) || 0,
      insuranceUntil: f.insuranceUntil || null,
      nextServiceKm: numOrNull(f.nextServiceKm),
      // Пустое поле — процент не задан, автомобиль наследует общий.
      managerPercent:
        f.managerPercent.trim() === "" ? null : Number(f.managerPercent.replace(",", ".")),
    };

    start(async () => {
      try {
        if (isEdit) await updateCarAction(car!.id, payload);
        else await addCarAction(payload);
        setOpen(false);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Не удалось сохранить");
      }
    });
  }

  return (
    <>
      <button className={variant === "ghost" ? "btn ghost" : "btn"} onClick={openForm}>
        {!isEdit && <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span>}
        {label ?? (isEdit ? "Редактировать" : "Добавить автомобиль")}
      </button>

      {open && (
        <Modal
          title={isEdit ? "Редактирование автомобиля" : "Новый автомобиль"}
          subtitle="Обязательны госномер, марка, модель и парк — остальное можно заполнить позже"
          onClose={() => setOpen(false)}
        >
          <div className="form-grid">
            <div className="field">
              <label>Госномер *</label>
              <input value={f.plate} onChange={(e) => set("plate", e.target.value)} placeholder="А123ВС 177" />
            </div>
            <div className="field">
              <label>Автопарк *</label>
              <select value={f.parkId} onChange={(e) => set("parkId", e.target.value)}>
                {parks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Марка *</label>
              <input value={f.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Kia" />
            </div>
            <div className="field">
              <label>Модель *</label>
              <input value={f.model} onChange={(e) => set("model", e.target.value)} placeholder="K5" />
            </div>
            <div className="field">
              <label>Год выпуска</label>
              <input type="number" value={f.year} onChange={(e) => set("year", e.target.value)} placeholder="2022" />
            </div>
            <div className="field">
              <label>Статус</label>
              <select value={f.status} onChange={(e) => set("status", e.target.value as CarStatus)}>
                <option value="on">На линии</option>
                <option value="idle">В простое</option>
              </select>
            </div>
            <div className="field">
              <label>Закреплённый водитель</label>
              <select value={f.driverId} onChange={(e) => set("driverId", e.target.value)}>
                <option value="">— не назначен —</option>
                {parkDrivers.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
              </select>
              {parkDrivers.length === 0 && (
                <span className="field-hint">В этом парке ещё нет водителей — добавьте их в разделе «Водители»</span>
              )}
            </div>
            <div className="field">
              <label>Суточная ставка аренды, ₽</label>
              <input type="number" value={f.rate} onChange={(e) => set("rate", e.target.value)} placeholder="0" />
            </div>
            <div className="field">
              <label>Общий пробег, км</label>
              <input type="number" value={f.mileage} onChange={(e) => set("mileage", e.target.value)} placeholder="0" />
            </div>
            <div className="field">
              <label>Пробег за месяц, км</label>
              <input type="number" value={f.mileMonth} onChange={(e) => set("mileMonth", e.target.value)} placeholder="0" />
            </div>
            <div className="field">
              <label>Страховка действует до</label>
              <input type="date" value={f.insuranceUntil} onChange={(e) => set("insuranceUntil", e.target.value)} />
              <span className="field-hint">Из этой даты считается напоминание об окончании полиса</span>
            </div>
            <div className="field">
              <label>Следующее ТО при пробеге, км</label>
              <input type="number" value={f.nextServiceKm} onChange={(e) => set("nextServiceKm", e.target.value)} placeholder="напр. 150000" />
              <span className="field-hint">Напомним за 1000 км до этого значения</span>
            </div>
            <div className="field">
              <label>Процент управляющего, %</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={0.5}
                value={f.managerPercent}
                onChange={(e) => set("managerPercent", e.target.value)}
                placeholder="общий процент парка"
              />
              <span className="field-hint">Пусто — используется общий процент автопарка</span>
            </div>
          </div>

          {err && <div className="form-err">{err}</div>}

          <div className="form-actions">
            <button className="btn ghost" onClick={() => setOpen(false)}>Отмена</button>
            <button className="btn" disabled={pending} onClick={submit}>
              {pending ? "Сохранение…" : isEdit ? "Сохранить изменения" : "Сохранить автомобиль"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
