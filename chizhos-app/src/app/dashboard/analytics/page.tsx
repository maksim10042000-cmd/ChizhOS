import Link from "next/link";
import Topbar from "@/components/Topbar";
import { Stat } from "@/components/Stat";
import EmptyState from "@/components/EmptyState";
import { ProfitLineChart } from "@/components/charts/Charts";
import { formatPercent } from "@/components/PercentBadge";
import { currentContext } from "@/lib/current";
import { computeKpi } from "@/lib/domain/kpi";
import { rub } from "@/lib/format";

export const dynamic = "force-dynamic";

function Rank({
  i, name, sub, value, color,
}: {
  i: number; name: string; sub?: string; value: string; color?: string;
}) {
  return (
    <div className="rank-row">
      <div className={"rank-n" + (i === 0 ? " first" : "")}>{i + 1}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{name}</div>
        {sub && <div className="muted" style={{ fontSize: 11.5 }}>{sub}</div>}
      </div>
      <div style={{ fontWeight: 700, fontSize: 13.5, color: color ?? "var(--text)" }}>{value}</div>
    </div>
  );
}

function RankCard({
  title,
  color,
  items,
  emptyHint,
}: {
  title: string;
  color?: string;
  items: React.ReactNode[];
  emptyHint: string;
}) {
  return (
    <div className="card">
      <div className="card-title" style={{ color }}>{title}</div>
      {items.length === 0 ? (
        <div className="muted" style={{ fontSize: 12.5, padding: "8px 2px" }}>{emptyHint}</div>
      ) : (
        items
      )}
    </div>
  );
}

export default async function AnalyticsPage() {
  const { fleet } = await currentContext("analytics");

  if (fleet.cars.length === 0) {
    return (
      <>
        <Topbar title="Аналитика KPI" sub="Показатели эффективности" />
        <div className="content">
          <EmptyState
            icon="chart"
            title="Нет данных для аналитики"
            hint="KPI считаются по автомобилям парка. Добавьте автомобили, внесите платежи и расходы — показатели появятся автоматически."
            action={<Link className="btn" href="/dashboard/cars">Перейти к автомобилям</Link>}
          />
        </div>
      </>
    );
  }

  const kpi = computeKpi(fleet.cars);
  const profit = fleet.monthly.map((m) => ({
    m: m.m, income: m.income, expense: m.expense, net: m.income - m.expense,
  }));

  const byFines = [...fleet.cars]
    .map((c) => ({ c, v: c.expenses.filter((e) => e.cat === "fine").length }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, 5);

  const label = (c: (typeof fleet.cars)[number]) => `${c.brand} ${c.model}`.trim() || c.plate;
  const sub = (c: (typeof fleet.cars)[number]) =>
    `${c.plate}${c.driver ? " • " + c.driver : ""}`;

  return (
    <>
      <Topbar title="Аналитика KPI" sub="Показатели эффективности" />
      <div className="content">
        <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
          <div className="grid stat-row-3">
            <Stat label="Автомобилей на линии" value={kpi.onLinePct.toFixed(0) + "%"} />
            <Stat label="Ср. выручка / авто / день" value={rub(kpi.avgRevenueDay)} />
            <Stat label="Ср. прибыль / авто / мес" value={rub(kpi.avgProfitMonth)} />
            <Stat
              label="Стоимость экспл. 1 км"
              value={kpi.costPerKm > 0 ? kpi.costPerKm.toFixed(1) + " ₽" : "—"}
              note={kpi.costPerKm > 0 ? undefined : "нужен пробег за месяц"}
            />
            <Stat label="Ср. расходы на авто" value={rub(kpi.avgRepair)} />
            <Stat label="Всего автомобилей" value={String(fleet.cars.length)} />
          </div>

          <div className="grid stat-row-3">
            <Stat
              label="Выплата управляющему (мес)"
              value={rub(fleet.managerPay)}
              note={
                fleet.carsWithOwnPercent > 0
                  ? `${fleet.carsWithOwnPercent} авто с индивидуальным процентом`
                  : `общий процент ${formatPercent(fleet.globalManagerPercent)}%`
              }
            />
            <Stat label="Прибыль владельца (мес)" value={rub(fleet.ownerProfit)} note="после выплаты управляющему" />
            <Stat
              label="Средневзвешенный процент"
              value={formatPercent(kpi.effectivePercent) + "%"}
              note="доля выручки, уходящая управляющему"
            />
          </div>

          <ProfitLineChart data={profit} />

          <div className="grid two-col">
            <RankCard
              title="🏆 ТОП-5 прибыльных"
              color="var(--green)"
              emptyHint="Появится, когда будут внесены платежи."
              items={kpi.topCars.map((c, i) => (
                <Rank key={c.id} i={i} name={label(c)} sub={sub(c)} value={rub(c.fin.profit)} color="var(--green)" />
              ))}
            />
            <RankCard
              title="📉 ТОП-5 убыточных"
              color="var(--red)"
              emptyHint="Рейтинг убыточных строится, когда в парке больше пяти автомобилей."
              items={kpi.bottomCars.map((c, i) => (
                <Rank
                  key={c.id}
                  i={i}
                  name={label(c)}
                  sub={sub(c)}
                  value={rub(c.fin.profit)}
                  color={c.fin.profit < 0 ? "var(--red)" : "var(--text)"}
                />
              ))}
            />
          </div>

          <div className="grid two-col">
            <RankCard
              title="Дисциплина оплаты"
              emptyHint="Появится после первых платежей по аренде."
              items={kpi.topDiscipline.map((it, i) => (
                <Rank
                  key={it.car.id}
                  i={i}
                  name={it.car.driver || label(it.car)}
                  sub={sub(it.car)}
                  value={it.value.toFixed(0) + "%"}
                  color="var(--green)"
                />
              ))}
            />
            <RankCard
              title="Рейтинг по штрафам"
              emptyHint="Штрафов не зарегистрировано."
              items={byFines.map((it, i) => (
                <Rank
                  key={it.c.id}
                  i={i}
                  name={it.c.driver || label(it.c)}
                  sub={sub(it.c)}
                  value={it.v + " шт."}
                  color="var(--red)"
                />
              ))}
            />
          </div>
        </div>
      </div>
    </>
  );
}
