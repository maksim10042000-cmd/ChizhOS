import Link from "next/link";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";
import { currentContext } from "@/lib/current";
import { today, rub } from "@/lib/format";

export const dynamic = "force-dynamic";

type Ev = { label: string; amount: number; st: "g" | "r" };

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const DOWS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default async function CalendarPage() {
  const { fleet } = await currentContext("calendar");
  const now = today();
  const y = now.getFullYear();
  const m = now.getMonth();
  // В России неделя начинается с понедельника, а getDay() считает от воскресенья.
  const startDow = (new Date(y, m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  // Календарь строится по фактическим датам платежей текущего месяца.
  const evByDay: Record<number, Ev[]> = {};
  let monthTotal = 0;
  let monthPaid = 0;

  fleet.cars.forEach((c) => {
    c.payments.forEach((p) => {
      if (p.date.getFullYear() !== y || p.date.getMonth() !== m) return;
      const day = p.date.getDate();
      (evByDay[day] = evByDay[day] ?? []).push({
        label: c.plate,
        amount: p.amount,
        st: p.paid ? "g" : "r",
      });
      monthTotal += p.amount;
      if (p.paid) monthPaid += p.amount;
    });
  });

  const hasEvents = Object.keys(evByDay).length > 0;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <>
      <Topbar title="Календарь" sub="Платежи по аренде по дням" />
      <div className="content">
        {fleet.cars.length === 0 ? (
          <EmptyState
            icon="cal"
            title="Нет данных для календаря"
            hint="Календарь показывает платежи по аренде. Добавьте автомобиль и внесите первый платёж."
            action={<Link className="btn" href="/dashboard/cars">Перейти к автомобилям</Link>}
          />
        ) : (
          <div className="card">
            <div className="card-title" style={{ alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <span>Календарь оплат — {MONTHS[m]} {y}</span>
              <span className="legend-row">
                <span><span className="ldot" style={{ background: "var(--green-ring)" }} />Оплачено</span>
                <span><span className="ldot" style={{ background: "var(--red-ring)" }} />Не оплачено</span>
              </span>
            </div>

            {hasEvents ? (
              <>
                <div className="cal-summary">
                  <span>Начислено за месяц: <b>{rub(monthTotal)}</b></span>
                  <span>Оплачено: <b style={{ color: "var(--green)" }}>{rub(monthPaid)}</b></span>
                  <span>Задолженность: <b style={{ color: monthTotal - monthPaid > 0 ? "var(--red)" : undefined }}>
                    {rub(monthTotal - monthPaid)}
                  </b></span>
                </div>
                <div className="cal">
                  {DOWS.map((d) => <div className="cal-dow" key={d}>{d}</div>)}
                  {cells.map((d, i) => {
                    if (!d) return <div key={i} className="cal-cell dim" />;
                    const evs = evByDay[d] ?? [];
                    const isToday = d === now.getDate();
                    return (
                      <div key={i} className={"cal-cell" + (isToday ? " today" : "")}>
                        <div className="cd">{d}</div>
                        {evs.slice(0, 3).map((e, j) => (
                          <div key={j} className={"cal-ev " + e.st} title={`${e.label} • ${rub(e.amount)}`}>
                            {e.label} {rub(e.amount)}
                          </div>
                        ))}
                        {evs.length > 3 && (
                          <div className="muted" style={{ fontSize: 10.5 }}>+{evs.length - 3} ещё</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <EmptyState
                compact
                icon="cal"
                title={`В ${MONTHS[m].toLowerCase()} платежей нет`}
                hint="Внесите платежи в карточке автомобиля — они появятся в календаре по своим датам."
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
