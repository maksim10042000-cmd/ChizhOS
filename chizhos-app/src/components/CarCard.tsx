"use client";

import { useTransition } from "react";
import Icon from "@/components/Icon";
import PaymentStatusSelect from "@/components/actions/PaymentStatusSelect";
import AddPaymentButton from "@/components/actions/AddPaymentButton";
import CarFormButton, { type DriverOption } from "@/components/actions/CarFormButton";
import CarManagerPercent from "@/components/actions/CarManagerPercent";
import DocSection from "@/components/actions/DocSection";
import { deleteCarAction } from "@/lib/actions";
import { rub, km } from "@/lib/format";
import { EXPENSE_CATS, EXPENSE_COLORS, type DerivedCar, type Park } from "@/lib/types";

const VEHICLE_DOC_TYPES = [
  "СТС",
  "ПТС",
  "Договор аренды",
  "Страховой полис (ОСАГО/КАСКО)",
  "Диагностическая карта",
  "Другое",
];

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="mini-metric">
      <div className="mk">{k}</div>
      <div className="mv">{v}</div>
    </div>
  );
}

export default function CarCard({
  car,
  parkName,
  parks,
  drivers,
  isAdmin,
  canEditPercent,
  globalPercent,
  onClose,
}: {
  car: DerivedCar;
  parkName: string;
  parks: Park[];
  drivers: DriverOption[];
  isAdmin: boolean;
  canEditPercent: boolean;
  globalPercent: number;
  onClose: () => void;
}) {
  const f = car.fin;
  const [pending, start] = useTransition();
  // Новые платежи сверху: последние события важнее старых.
  const history = [...car.payments].reverse().slice(0, 30);

  function remove() {
    if (
      !window.confirm(
        `Удалить автомобиль ${car.plate}?\n\nВместе с ним будут удалены его платежи, расходы и документы. Действие нельзя отменить.`
      )
    ) return;
    start(async () => {
      await deleteCarAction(car.id);
      onClose();
    });
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="plate" style={{ fontSize: 14 }}>{car.plate}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{car.brand} {car.model}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {car.year ? `${car.year} • ` : ""}{parkName}
            </div>
          </div>
          <span className={"st " + (car.status === "on" ? "on" : "idle")} style={{ marginLeft: 12 }}>
            <span className="d2" />
            {car.status === "on" ? "На линии" : "В простое"}
          </span>
          <button className="close-x" onClick={onClose} aria-label="Закрыть"><Icon name="x" size={18} /></button>
        </div>

        <div className="drawer-body">
          <div className="card">
            <div className="card-title">
              Общая информация
              <span style={{ display: "flex", gap: 8 }}>
                <CarFormButton parks={parks} drivers={drivers} car={car} variant="ghost" />
                {isAdmin && (
                  <button className="btn ghost danger" disabled={pending} onClick={remove}>
                    {pending ? "Удаление…" : "Удалить"}
                  </button>
                )}
              </span>
            </div>
            <div className="kv">
              <div className="kvrow"><span className="k">Марка</span><span className="val">{car.brand}</span></div>
              <div className="kvrow"><span className="k">Модель</span><span className="val">{car.model}</span></div>
              <div className="kvrow"><span className="k">Госномер</span><span className="val">{car.plate}</span></div>
              <div className="kvrow"><span className="k">Парк</span><span className="val">{parkName}</span></div>
              <div className="kvrow">
                <span className="k">Водитель</span>
                <span className="val">{car.driver || <span className="muted">не назначен</span>}</span>
              </div>
              <div className="kvrow">
                <span className="k">Телефон</span>
                <span className="val">{car.phone || <span className="muted">—</span>}</span>
              </div>
              <div className="kvrow">
                <span className="k">Ставка в сутки</span>
                <span className="val">{car.rate ? rub(car.rate) : <span className="muted">не указана</span>}</span>
              </div>
              <div className="kvrow">
                <span className="k">Страховка</span>
                <span className="val">
                  {car.insuranceDays == null ? (
                    <span className="muted">не указана</span>
                  ) : car.insuranceDays < 0 ? (
                    <span style={{ color: "var(--red)" }}>истекла {Math.abs(car.insuranceDays)} дн. назад</span>
                  ) : (
                    `осталось ${car.insuranceDays} дн.`
                  )}
                </span>
              </div>
              <div className="kvrow">
                <span className="k">До ТО</span>
                <span className="val">
                  {car.toRemainingKm == null ? (
                    <span className="muted">не указано</span>
                  ) : car.toRemainingKm < 0 ? (
                    <span style={{ color: "var(--red)" }}>просрочено на {km(Math.abs(car.toRemainingKm))}</span>
                  ) : (
                    km(car.toRemainingKm)
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="sec-h">Пробег и финансы</div>
          <div className="grid metric-row">
            <Metric k="Общий пробег" v={car.mileage ? km(car.mileage) : "—"} />
            <Metric k="Средний в сутки" v={car.mileMonth ? km(f.avgDay) : "—"} />
            <Metric k="Доход за месяц" v={rub(f.income.month)} />
            <Metric k="Доход за всё время" v={rub(f.income.all)} />
          </div>
          <div className="grid metric-row" style={{ marginTop: 12 }}>
            <Metric k="Расходы (всё)" v={rub(f.expAll)} />
            <Metric k="Чистая прибыль" v={rub(f.profit)} />
            <Metric k="Рентабельность" v={f.income.all ? f.roi.toFixed(1) + "%" : "—"} />
            <Metric k="Прибыль на км" v={car.mileMonth ? f.perKm.toFixed(1) + " ₽" : "—"} />
          </div>

          <div className="sec-h">Финансовые настройки</div>
          <CarManagerPercent
            carId={car.id}
            ownPercent={car.managerPercent}
            globalPercent={globalPercent}
            fin={f}
            canEdit={canEditPercent}
          />

          <div className="sec-h">Расходы автомобиля</div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Наименование</th><th>Категория</th><th>Дата</th><th className="right">Сумма</th></tr>
              </thead>
              <tbody>
                {[...car.expenses]
                  .sort((a, b) => b.date.getTime() - a.date.getTime())
                  .slice(0, 10)
                  .map((e) => (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 600 }}>{e.name}</td>
                      <td>
                        <span className="chip" style={{ background: EXPENSE_COLORS[e.cat] + "1a", color: EXPENSE_COLORS[e.cat] }}>
                          {EXPENSE_CATS[e.cat]}
                        </span>
                      </td>
                      <td className="muted">{e.date.toLocaleDateString("ru-RU")}</td>
                      <td className="right" style={{ fontWeight: 600 }}>{rub(e.amount)}</td>
                    </tr>
                  ))}
                {car.expenses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted" style={{ textAlign: "center", padding: 16 }}>
                      Расходов по этому автомобилю нет — добавьте их в разделе «Расходы»
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="sec-h">
            История платежей
            <AddPaymentButton carId={car.id} defaultAmount={car.rate} />
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Дата</th><th className="right">Сумма</th><th>Способ</th><th>Статус</th></tr>
              </thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id}>
                    <td>{p.date.toLocaleDateString("ru-RU")}</td>
                    <td className="right" style={{ fontWeight: 600 }}>{rub(p.amount)}</td>
                    <td className="muted">{p.method}</td>
                    <td><PaymentStatusSelect paymentId={p.id} paid={p.paid} /></td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted" style={{ textAlign: "center", padding: 16 }}>
                      Платежей нет — нажмите «Внести платёж», чтобы начислить первый
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <DocSection
            carId={car.id}
            kind="vehicle"
            title="Документы автомобиля"
            docs={car.docs}
            types={VEHICLE_DOC_TYPES}
          />
          <DocSection
            carId={car.id}
            kind="driver"
            title="Документы водителя"
            docs={car.driverDocs}
            disabled={!car.driverId}
            disabledHint="Закрепите водителя за автомобилем — документы привязываются к нему"
          />
        </div>
      </div>
    </div>
  );
}
