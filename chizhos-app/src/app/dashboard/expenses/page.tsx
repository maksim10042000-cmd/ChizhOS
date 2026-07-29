import Topbar from "@/components/Topbar";
import { Stat } from "@/components/Stat";
import AddExpenseButton from "@/components/actions/AddExpenseButton";
import ExpenseRowActions from "@/components/actions/ExpenseRowActions";
import EmptyState from "@/components/EmptyState";
import { currentContext } from "@/lib/current";
import { EXPENSE_CATS, EXPENSE_COLORS, type DerivedCar, type Expense, type ExpenseCat } from "@/lib/types";
import { rub, DAY, today } from "@/lib/format";

export const dynamic = "force-dynamic";

type Row = Expense & { car: DerivedCar | null };

export default async function ExpensesPage() {
  const { session, fleet } = await currentContext("expenses");
  const isAdmin = session.role === "admin";

  const all: Row[] = [];
  fleet.cars.forEach((c) => c.expenses.forEach((e) => all.push({ ...e, car: c })));
  fleet.generalExpenses.forEach((e) => all.push({ ...e, car: null }));
  all.sort((a, b) => b.date.getTime() - a.date.getTime());

  const now = today().getTime();
  const sumIn = (days: number) =>
    all.filter((e) => now - e.date.getTime() < days * DAY).reduce((s, e) => s + e.amount, 0);

  const cats = Object.keys(EXPENSE_CATS) as ExpenseCat[];
  const totals: Record<string, number> = {};
  cats.forEach((k) => (totals[k] = 0));
  all.forEach((e) => (totals[e.cat] += e.amount));

  const carOptions = fleet.cars.map((c) => ({ id: c.id, plate: c.plate, brand: c.brand, model: c.model }));
  const parkOptions = fleet.parks.map((p) => ({ id: p.id, name: p.name }));

  return (
    <>
      <Topbar
        title="Расходы"
        sub="Затраты по автомобилям и общие"
        action={<AddExpenseButton cars={carOptions} parks={parkOptions} isAdmin={isAdmin} />}
      />
      <div className="content">
        {all.length === 0 ? (
          <EmptyState
            icon="receipt"
            title="Нет расходов"
            hint={
              fleet.cars.length === 0
                ? "Расход можно отнести на автомобиль или сделать общим. Сначала добавьте автомобиль либо внесите общий расход."
                : "Добавьте первый расход — ТО, запчасти, мойку, страховку или штраф. Он сразу попадёт в финансовые показатели."
            }
            action={<AddExpenseButton cars={carOptions} parks={parkOptions} isAdmin={isAdmin} label="Добавить первый расход" />}
          />
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
            <div className="grid stat-row-4">
              <Stat label="Расход за день" value={rub(sumIn(1))} />
              <Stat label="За неделю" value={rub(sumIn(7))} />
              <Stat label="За месяц" value={rub(sumIn(30))} />
              <Stat label="За год" value={rub(sumIn(365))} />
            </div>

            <div className="grid expenses-split">
              <div className="card">
                <div className="card-title">По категориям (всё время)</div>
                {cats.map((k) => (
                  <div key={k} className="park">
                    <div className="pn">
                      <span className="pdot" style={{ background: EXPENSE_COLORS[k] }} />
                      {EXPENSE_CATS[k]}
                    </div>
                    <b className={totals[k] === 0 ? "muted" : undefined}>{rub(totals[k])}</b>
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="card-title">
                  Журнал расходов
                  <span className="chip b">{all.length}</span>
                </div>
                <div className="tbl-wrap" style={{ maxHeight: 520, overflowY: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Дата</th>
                        <th>Наименование</th>
                        <th>Категория</th>
                        <th>Авто</th>
                        <th className="right">Сумма</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {all.slice(0, 200).map((e) => (
                        <tr key={e.id}>
                          <td className="muted">{e.date.toLocaleDateString("ru-RU")}</td>
                          <td style={{ fontWeight: 600 }}>{e.name}</td>
                          <td>
                            <span className="chip" style={{ background: EXPENSE_COLORS[e.cat] + "1a", color: EXPENSE_COLORS[e.cat] }}>
                              {EXPENSE_CATS[e.cat]}
                            </span>
                          </td>
                          <td>
                            {e.car ? <span className="plate">{e.car.plate}</span> : <span className="muted">общий</span>}
                          </td>
                          <td className="right" style={{ fontWeight: 600 }}>{rub(e.amount)}</td>
                          <td className="row-actions">
                            <ExpenseRowActions id={e.id} name={e.name} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {all.length > 200 && (
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
                    Показаны последние 200 записей из {all.length}.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
