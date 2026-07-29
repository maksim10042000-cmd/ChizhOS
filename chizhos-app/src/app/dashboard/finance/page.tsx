import Link from "next/link";
import Topbar from "@/components/Topbar";
import { Stat } from "@/components/Stat";
import ManagerCard from "@/components/ManagerCard";
import EmptyState from "@/components/EmptyState";
import { IncomeDailyChart, MonthlyBarChart, ProfitLineChart, ExpensePie } from "@/components/charts/Charts";
import { formatPercent } from "@/components/PercentBadge";
import { currentContext } from "@/lib/current";
import { deltaPct } from "@/lib/domain/finance";
import { rub } from "@/lib/format";
import { EXPENSE_CATS, EXPENSE_COLORS, type ExpenseCat } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const { session, fleet } = await currentContext("finance");
  const cats = Object.keys(EXPENSE_CATS) as ExpenseCat[];

  if (fleet.cars.length === 0) {
    return (
      <>
        <Topbar title="Финансы" sub="Доходы, расходы и прибыль" />
        <div className="content">
          <EmptyState
            icon="money"
            title="Нет финансовых операций"
            hint="Финансовые показатели считаются по автомобилям парка. Добавьте первый автомобиль и внесите платежи по аренде."
            action={<Link className="btn" href="/dashboard/cars">Перейти к автомобилям</Link>}
          />
        </div>
      </>
    );
  }

  const daily = fleet.series.map((s) => ({
    label: `${s.date.getDate()}.${s.date.getMonth() + 1}`,
    income: s.income,
  }));
  const monthly = fleet.monthly.map((m) => ({ m: m.m, income: m.income }));
  const profit = fleet.monthly.map((m) => ({
    m: m.m, income: m.income, expense: m.expense, net: m.income - m.expense,
  }));
  const pie = cats.map((k) => ({ name: EXPENSE_CATS[k], value: fleet.brk[k] ?? 0, color: EXPENSE_COLORS[k] }));

  const rows = [...fleet.cars]
    .map((c) => ({
      car: c,
      income: c.fin.income.all,
      exp: c.fin.expAll,
      profit: c.fin.profit,
      perKm: c.mileage ? c.fin.income.all / c.mileage : 0,
    }))
    .sort((a, b) => b.profit - a.profit);

  return (
    <>
      <Topbar title="Финансы" sub="Доходы, расходы и прибыль" />
      <div className="content">
        <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
          {!fleet.hasFinanceData && (
            <div className="notice">
              Финансовых операций пока нет. Внесите платежи в карточке автомобиля и расходы
              в разделе «Расходы» — показатели и графики заполнятся автоматически.
            </div>
          )}

          <div className="grid stat-row-5">
            <Stat label="Доход сегодня" value={rub(fleet.incToday)} delta={deltaPct(fleet.incToday, fleet.incYesterday)} deltaLabel="к вчера" note="нет данных за вчера" />
            <Stat label="Доход за неделю" value={rub(fleet.incWeek)} delta={deltaPct(fleet.incWeek, fleet.incPrevWeek)} deltaLabel="к прошлой" note="нет данных за прошлую неделю" />
            <Stat label="Доход за месяц" value={rub(fleet.incMonth)} delta={deltaPct(fleet.incMonth, fleet.incPrevMonth)} deltaLabel="к прошлому" note="нет данных за прошлый месяц" />
            <Stat label="Расход за месяц" value={rub(fleet.expMonth)} delta={deltaPct(fleet.expMonth, fleet.expPrevMonth)} deltaLabel="к прошлому" note="нет данных за прошлый месяц" />
            <Stat label="Чистая прибыль" value={rub(fleet.profit)} delta={deltaPct(fleet.profit, fleet.prevProfit)} deltaLabel="к прошлому" note="нет данных за прошлый месяц" />
          </div>

          <div className="grid stat-row-2">
            <Stat label="Выплата управляющему (мес)" value={rub(fleet.managerPay)} note="по проценту каждого автомобиля" />
            <Stat label="Прибыль владельца (мес)" value={rub(fleet.ownerProfit)} note="чистая прибыль за вычетом выплаты" />
          </div>

          <ManagerCard
            incMonth={fleet.incMonth}
            profit={fleet.profit}
            globalPercent={fleet.globalManagerPercent}
            managerPay={fleet.managerPay}
            ownerProfit={fleet.ownerProfit}
            carsWithOwnPercent={fleet.carsWithOwnPercent}
            totalCars={fleet.cars.length}
            canEdit={session.role === "admin"}
          />

          <div className="grid finance-split">
            <IncomeDailyChart data={daily} />
            <ExpensePie data={pie} />
          </div>
          <div className="grid two-col">
            <MonthlyBarChart data={monthly} />
            <ProfitLineChart data={profit} />
          </div>

          <div className="card">
            <div className="card-title">
              Доходность автомобилей
              <span className="muted" style={{ fontWeight: 500 }}>
                суммы за всё время
              </span>
            </div>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Автомобиль</th><th>Парк</th><th className="right">Доход</th>
                    <th className="right">Расходы</th>
                    <th className="right">%</th>
                    <th className="right">Управляющему</th>
                    <th className="right">Владельцу</th>
                    <th className="right">Доход/км</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.car.id}>
                      <td>
                        <span className="plate">{r.car.plate}</span>{" "}
                        <span style={{ fontWeight: 600, marginLeft: 6 }}>{r.car.brand} {r.car.model}</span>
                      </td>
                      <td>{fleet.parkName(r.car.parkId)}</td>
                      <td className="right">{rub(r.income)}</td>
                      <td className="right">{rub(r.exp)}</td>
                      <td className="right">
                        <span className={r.car.fin.managerPercentSource === "own" ? "pct-cell own" : "pct-cell"}>
                          {formatPercent(r.car.fin.managerPercent)}%
                        </span>
                      </td>
                      <td className="right" style={{ color: "var(--amber)" }}>
                        {rub(r.car.fin.managerPayAll)}
                      </td>
                      <td className="right" style={{ fontWeight: 700, color: r.car.fin.ownerProfitAll > 0 ? "var(--green)" : r.car.fin.ownerProfitAll < 0 ? "var(--red)" : undefined }}>
                        {rub(r.car.fin.ownerProfitAll)}
                      </td>
                      <td className="right">{r.car.mileage ? r.perKm.toFixed(1) + " ₽" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
              Процент, выделенный цветом, задан индивидуально для автомобиля.
              «Владельцу» — доход за вычетом расходов и выплаты управляющему.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
