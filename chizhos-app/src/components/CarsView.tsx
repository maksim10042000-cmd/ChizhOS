"use client";

import { useState } from "react";
import CarCard from "@/components/CarCard";
import StatusToggle from "@/components/actions/StatusToggle";
import PayButton from "@/components/actions/PayButton";
import CarFormButton, { type DriverOption } from "@/components/actions/CarFormButton";
import BulkPercentButton from "@/components/actions/BulkPercentButton";
import Icon from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import { formatPercent } from "@/components/PercentBadge";
import { lastPaid } from "@/lib/domain/overdue";
import { INSURANCE_SOON_DAYS } from "@/lib/domain/notifications";
import type { DerivedCar, Park } from "@/lib/types";

function PayCell({ car }: { car: DerivedCar }) {
  if (car.payments.length === 0) {
    return <span className="pill n">Платежей нет</span>;
  }
  if (car.overdue > 0) {
    const d = car.overdue;
    const word = d === 1 ? "день" : d < 5 ? "дня" : "дней";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="pill r">Просрочка {d} {word}</span>
        <PayButton carId={car.id} overdue={car.overdue} />
      </div>
    );
  }
  if (lastPaid(car.payments)) return <span className="pill g">Оплачено</span>;
  return <span className="pill y">Ожидается оплата</span>;
}

/** Ячейка процента: индивидуальный выделяется цветом. */
function PercentCell({ car }: { car: DerivedCar }) {
  const own = car.fin.managerPercentSource === "own";
  return (
    <span
      className={"pct-cell" + (own ? " own" : "")}
      title={own ? "Индивидуальный процент" : "Общий процент автопарка"}
    >
      {formatPercent(car.fin.managerPercent)}%
    </span>
  );
}

export default function CarsView({
  cars,
  parks,
  drivers,
  initialFilter = "all",
  isAdmin,
  canEditPercent,
  globalPercent,
}: {
  cars: DerivedCar[];
  parks: Park[];
  drivers: DriverOption[];
  initialFilter?: string;
  isAdmin: boolean;
  canEditPercent: boolean;
  globalPercent: number;
}) {
  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const nameOf = (id: string) => parks.find((p) => p.id === id)?.name ?? "—";
  const parkIds = parks.map((p) => p.id);

  // Пока автомобилей нет вообще — фильтры и поиск не нужны.
  if (cars.length === 0) {
    return (
      <EmptyState
        icon="car"
        title="Нет автомобилей"
        hint={
          parks.length === 0
            ? "Сначала создайте автопарк в разделе «Администрирование» — автомобиль нужно к чему-то привязать."
            : "Добавьте первый автомобиль: госномер, марка, модель и парк. Остальное можно заполнить позже."
        }
        action={
          parks.length > 0 ? (
            <CarFormButton parks={parks} drivers={drivers} label="Добавить первый автомобиль" />
          ) : null
        }
      />
    );
  }

  const filters: [string, string][] = [
    ["all", "Все"], ["on", "На линии"], ["idle", "В простое"],
    ...parks.map((p) => [p.id, p.name] as [string, string]),
    ["debt", "Должники"], ["to_soon", "Скоро ТО"], ["ins_soon", "Страховка ⏳"],
    ["own_pct", "Свой процент"],
  ];

  let rows = cars.filter((c) => {
    if (filter === "on") return c.status === "on";
    if (filter === "idle") return c.status === "idle";
    if (filter === "debt") return c.overdue > 0;
    if (filter === "to_soon") return c.toSoon;
    if (filter === "ins_soon") return c.insuranceDays != null && c.insuranceDays < INSURANCE_SOON_DAYS;
    if (filter === "own_pct") return c.fin.managerPercentSource === "own";
    if (parkIds.includes(filter)) return c.parkId === filter;
    return true;
  });
  if (search.trim()) {
    const q = search.toLowerCase();
    rows = rows.filter((c) =>
      [c.plate, c.brand, c.model, c.driver].some((x) => (x ?? "").toLowerCase().includes(q))
    );
  }
  rows = [...rows].sort((a, b) => a.plate.localeCompare(b.plate, "ru"));

  const debtors = cars.filter((c) => c.overdue > 0).length;
  const ownPct = cars.filter((c) => c.fin.managerPercentSource === "own").length;
  const selectedCar = selId ? cars.find((c) => c.id === selId) ?? null : null;

  // Галочка «выбрать все» работает по видимым строкам, а не по всему парку.
  const visibleIds = rows.map((c) => c.id);
  const selectedVisible = visibleIds.filter((id) => selected.has(id));
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  return (
    <>
      <div className="toolbar">
        <div className="filters">
          {filters.map(([k, l]) => (
            <button key={k} className={"fbtn" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>
              {l}
              {k === "debt" && debtors > 0 ? " • " + debtors : ""}
              {k === "own_pct" && ownPct > 0 ? " • " + ownPct : ""}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {canEditPercent && (
            <BulkPercentButton
              selectedIds={Array.from(selected)}
              totalCars={cars.length}
              globalPercent={globalPercent}
              onDone={() => setSelected(new Set())}
            />
          )}
          <CarFormButton parks={parks} drivers={drivers} />
        </div>
      </div>

      <div className="search-wrap">
        <span className="search-ico">
          <Icon name="search" size={16} color="#9aa1ad" />
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск: госномер, марка, модель, ФИО…"
          className="search-input"
        />
      </div>

      {canEditPercent && selected.size > 0 && (
        <div className="sel-bar">
          Выбрано автомобилей: <b>{selected.size}</b>
          <button className="doc-btn" onClick={() => setSelected(new Set())}>Снять выделение</button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          compact
          icon="search"
          title="Ничего не найдено"
          hint="Измените фильтр или поисковый запрос."
        />
      ) : (
        <>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  {canEditPercent && (
                    <th className="cb-col">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        aria-label="Выбрать все автомобили в списке"
                      />
                    </th>
                  )}
                  <th>Госномер</th><th>Марка</th><th>Модель</th><th>Парк</th>
                  <th>Водитель</th><th>Телефон</th>
                  <th className="right">Процент</th>
                  <th>Статус</th><th>Оплата аренды</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="rowlink" onClick={() => setSelId(c.id)}>
                    {canEditPercent && (
                      <td className="cb-col" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={() => toggleOne(c.id)}
                          aria-label={`Выбрать ${c.plate}`}
                        />
                      </td>
                    )}
                    <td><span className="plate">{c.plate}</span></td>
                    <td style={{ fontWeight: 600 }}>{c.brand}</td>
                    <td>{c.model}</td>
                    <td>{nameOf(c.parkId)}</td>
                    <td style={{ fontWeight: 600 }}>
                      {c.driver || <span className="muted" style={{ fontWeight: 400 }}>не назначен</span>}
                    </td>
                    <td className="muted">{c.phone || "—"}</td>
                    <td className="right"><PercentCell car={c} /></td>
                    <td onClick={(e) => e.stopPropagation()}><StatusToggle carId={c.id} status={c.status} /></td>
                    <td onClick={(e) => e.stopPropagation()}><PayCell car={c} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="muted" style={{ marginTop: 12, fontSize: 12.5 }}>
            Показано {rows.length} из {cars.length}. Нажмите на строку — откроется карточка авто.
            {ownPct > 0 && <> Цветом отмечен индивидуальный процент управляющего.</>}
          </div>
        </>
      )}

      {selectedCar && (
        <CarCard
          car={selectedCar}
          parkName={nameOf(selectedCar.parkId)}
          parks={parks}
          drivers={drivers}
          isAdmin={isAdmin}
          canEditPercent={canEditPercent}
          globalPercent={globalPercent}
          onClose={() => setSelId(null)}
        />
      )}
    </>
  );
}
