"use client";

import { useState, useTransition } from "react";
import DriverFormButton from "@/components/actions/DriverFormButton";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";
import { deleteDriverAction } from "@/lib/actions";
import { rub } from "@/lib/format";
import type { Park } from "@/lib/types";

export interface DriverRow {
  id: string;
  name: string;
  phone: string;
  parkId: string | null;
  parkName: string;
  cars: { plate: string; brand: string; model: string }[];
  incomeMonth: number;
  debt: number;
  overdue: number;
  /** null — платежей ещё не было, дисциплину считать не из чего. */
  discipline: number | null;
  licenseNo: string;
  passport: string;
  address: string;
  deposit: number;
  comment: string;
  active: boolean;
}

function DisciplineBar({ value }: { value: number | null }) {
  if (value == null) return <span className="muted">—</span>;
  const color = value > 85 ? "var(--green-ring)" : value > 60 ? "#f59e0b" : "var(--red-ring)";
  return (
    <div className="disc" title={value.toFixed(0) + "% платежей внесено вовремя"}>
      <div className="disc-bar">
        <div style={{ height: "100%", width: value + "%", background: color, borderRadius: 4 }} />
      </div>
      <span className="disc-val">{value.toFixed(0)}%</span>
    </div>
  );
}

function DeleteDriverButton({ row }: { row: DriverRow }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="icon-btn del"
      title="Удалить водителя"
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        const warn = row.cars.length
          ? `\n\nОн закреплён за автомобилями: ${row.cars.map((c) => c.plate).join(", ")}. Автомобили останутся, водитель будет откреплён.`
          : "";
        if (window.confirm(`Удалить водителя «${row.name}»?${warn}\n\nДействие нельзя отменить.`)) {
          start(async () => { await deleteDriverAction(row.id); });
        }
      }}
    >
      <Icon name="x" size={14} />
    </button>
  );
}

export default function DriversView({
  rows,
  parks,
  initialFilter = "all",
  isAdmin,
}: {
  rows: DriverRow[];
  parks: Park[];
  initialFilter?: string;
  isAdmin: boolean;
}) {
  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState("");

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="users"
        title="Нет водителей"
        hint={
          parks.length === 0
            ? "Сначала создайте автопарк в разделе «Администрирование»."
            : "Добавьте первого водителя — после этого его можно будет закрепить за автомобилем."
        }
        action={parks.length > 0 ? <DriverFormButton parks={parks} label="Добавить первого водителя" /> : null}
      />
    );
  }

  const debtors = rows.filter((r) => r.overdue > 0).length;
  const free = rows.filter((r) => r.cars.length === 0).length;

  let list = rows;
  if (filter === "debt") list = list.filter((r) => r.overdue > 0);
  if (filter === "free") list = list.filter((r) => r.cars.length === 0);
  if (search.trim()) {
    const q = search.toLowerCase();
    list = list.filter((r) =>
      [r.name, r.phone, r.licenseNo, ...r.cars.map((c) => c.plate)].some((x) =>
        (x ?? "").toLowerCase().includes(q)
      )
    );
  }

  return (
    <>
      <div className="toolbar">
        <div className="filters">
          <button className={"fbtn" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>
            Все водители • {rows.length}
          </button>
          <button className={"fbtn" + (filter === "debt" ? " on" : "")} onClick={() => setFilter("debt")}>
            С просрочкой{debtors > 0 ? " • " + debtors : ""}
          </button>
          <button className={"fbtn" + (filter === "free" ? " on" : "")} onClick={() => setFilter("free")}>
            Без автомобиля{free > 0 ? " • " + free : ""}
          </button>
        </div>
        <DriverFormButton parks={parks} />
      </div>

      <div className="search-wrap">
        <span className="search-ico">
          <Icon name="search" size={16} color="#9aa1ad" />
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск: ФИО, телефон, права, госномер…"
          className="search-input"
        />
      </div>

      {list.length === 0 ? (
        <EmptyState compact icon="search" title="Ничего не найдено" hint="Измените фильтр или поисковый запрос." />
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Водитель</th><th>Телефон</th><th>Автомобиль</th><th>Парк</th>
                <th className="right">Доход (мес)</th><th className="right">Долг</th>
                <th>Дисциплина</th><th>Статус</th><th />
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>
                    {r.name}
                    {!r.active && <span className="chip" style={{ marginLeft: 6 }}>неактивен</span>}
                  </td>
                  <td className="muted">{r.phone || "—"}</td>
                  <td>
                    {r.cars.length === 0 ? (
                      <span className="muted">не назначен</span>
                    ) : (
                      r.cars.map((c) => (
                        <span key={c.plate} style={{ marginRight: 6 }}>
                          <span className="plate">{c.plate}</span>{" "}
                          <span className="muted">{c.brand} {c.model}</span>
                        </span>
                      ))
                    )}
                  </td>
                  <td>{r.parkName}</td>
                  <td className="right">{rub(r.incomeMonth)}</td>
                  <td className="right" style={{ color: r.debt > 0 ? "var(--red)" : undefined, fontWeight: r.debt > 0 ? 700 : 400 }}>
                    {r.debt > 0 ? rub(r.debt) : "—"}
                  </td>
                  <td><DisciplineBar value={r.discipline} /></td>
                  <td>
                    {r.overdue > 0 ? (
                      <span className="pill r">Долг {r.overdue} дн.</span>
                    ) : r.cars.length === 0 ? (
                      <span className="pill b">Доступен для назначения</span>
                    ) : (
                      <span className="pill g">Активен</span>
                    )}
                  </td>
                  <td className="row-actions">
                    <DriverFormButton parks={parks} driver={r} variant="icon" />
                    {isAdmin && <DeleteDriverButton row={r} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="muted" style={{ marginTop: 12, fontSize: 12.5 }}>
        Показано {list.length} из {rows.length}.
      </div>
    </>
  );
}
