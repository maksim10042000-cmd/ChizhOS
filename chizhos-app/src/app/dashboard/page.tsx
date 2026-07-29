import Link from "next/link";
import Topbar from "@/components/Topbar";
import { Stat } from "@/components/Stat";
import Icon from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import { IncomeDailyChart } from "@/components/charts/Charts";
import { currentContext } from "@/lib/current";
import { deltaPct } from "@/lib/domain/finance";
import { INSURANCE_SOON_DAYS } from "@/lib/domain/notifications";
import { rub } from "@/lib/format";

export const dynamic = "force-dynamic";

const ATT_COLORS: Record<string, [string, string]> = {
  r: ["#fdecef", "#e11d48"],
  y: ["#fef6e7", "#d97706"],
  b: ["#eef3ff", "#2563eb"],
};

export default async function DashboardPage() {
  const { session, fleet } = await currentContext("dashboard");
  const isAdmin = session.role === "admin";

  // Пока в системе нет ни одного автомобиля, показывать нули и графики
  // бессмысленно — вместо этого объясняем, с чего начать.
  if (fleet.cars.length === 0) {
    return (
      <>
        <Topbar title="Dashboard" sub="Обзор автопарка на сегодня" />
        <div className="content">
          {fleet.parks.length === 0 ? (
            <EmptyState
              icon="car"
              title="Система готова к работе"
              hint={
                isAdmin
                  ? "Начните с создания автопарка — после этого можно добавлять автомобили, водителей и пользователей."
                  : "Автопарк ещё не настроен. Обратитесь к администратору системы."
              }
              action={isAdmin ? <Link className="btn" href="/admin/parks">Создать автопарк</Link> : null}
            />
          ) : (
            <EmptyState
              icon="car"
              title="Нет автомобилей"
              hint="Добавьте первый автомобиль — после этого появятся показатели, графики и уведомления."
              action={<Link className="btn" href="/dashboard/cars">Добавить первый автомобиль</Link>}
            />
          )}
        </div>
      </>
    );
  }

  const onlinePct = ((fleet.onLine / fleet.cars.length) * 100).toFixed(0);
  const daily = fleet.series.map((s) => ({
    label: `${s.date.getDate()}.${s.date.getMonth() + 1}`,
    income: s.income,
  }));

  const insuranceSoon = fleet.cars.filter(
    (c) => c.insuranceDays != null && c.insuranceDays < INSURANCE_SOON_DAYS
  ).length;
  const toSoon = fleet.cars.filter((c) => c.toSoon).length;
  const fineCars = fleet.cars.filter((c) => c.expenses.some((e) => e.cat === "fine")).length;

  const attention = [
    { icon: "alert", c: "r", t: "Просроченные оплаты", n: fleet.debtors.length, href: "/dashboard/drivers?f=debt" },
    { icon: "car", c: "r", t: "Автомобили в простое", n: fleet.idle, href: "/dashboard/cars?f=idle" },
    { icon: "wrench", c: "y", t: "Приближается ТО", n: toSoon, href: "/dashboard/cars?f=to_soon" },
    { icon: "shield", c: "y", t: "Заканчивается страховка", n: insuranceSoon, href: "/dashboard/cars?f=ins_soon" },
    { icon: "receipt", c: "b", t: "Автомобили со штрафами", n: fineCars, href: "/dashboard/expenses" },
  ];

  return (
    <>
      <Topbar title="Dashboard" sub="Обзор автопарка на сегодня" />
      <div className="content">
        <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
          <div className="circle-row">
            <Link href="/dashboard/cars?f=on" className="status-circle hl">
              <div className="ring green"><span className="lbl">НА ЛИНИИ</span><span className="big">{fleet.onLine}</span></div>
              <div className="sc-meta">
                <h3>Автомобили на линии</h3>
                <p>Активно работают и приносят доход. {onlinePct}% парка.</p>
              </div>
            </Link>
            <Link href="/dashboard/cars?f=idle" className="status-circle hl">
              <div className="ring red"><span className="lbl">В ПРОСТОЕ</span><span className="big">{fleet.idle}</span></div>
              <div className="sc-meta">
                <h3>Автомобили в простое</h3>
                <p>Не на линии: ремонт, ожидание водителя или простой.</p>
              </div>
            </Link>
          </div>

          <div className="grid stat-row-4">
            <Link href="/dashboard/finance">
              <Stat label="Доход сегодня" value={rub(fleet.incToday)} delta={deltaPct(fleet.incToday, fleet.incYesterday)} deltaLabel="к вчера" note="нет данных за вчера" />
            </Link>
            <Link href="/dashboard/finance">
              <Stat label="Доход за неделю" value={rub(fleet.incWeek)} delta={deltaPct(fleet.incWeek, fleet.incPrevWeek)} deltaLabel="к прошлой неделе" note="нет данных за прошлую неделю" />
            </Link>
            <Link href="/dashboard/finance">
              <Stat label="Доход за месяц" value={rub(fleet.incMonth)} delta={deltaPct(fleet.incMonth, fleet.incPrevMonth)} deltaLabel="к прошлому месяцу" note="нет данных за прошлый месяц" />
            </Link>
            <Link href="/dashboard/finance">
              <Stat label="Чистая прибыль (мес)" value={rub(fleet.profit)} delta={deltaPct(fleet.profit, fleet.prevProfit)} deltaLabel="к прошлому месяцу" note="нет данных за прошлый месяц" />
            </Link>
          </div>

          <div className="grid dash-split">
            <div className="card">
              <div className="card-title">
                Разделение по паркам <span className="chip b">{fleet.parks.length} парк(а)</span>
              </div>
              {fleet.parks.length === 0 ? (
                <EmptyState compact icon="car" title="Парки не созданы" />
              ) : (
                fleet.parks.map((p) => (
                  <Link key={p.id} href={`/dashboard/cars?f=${p.id}`} className="park">
                    <div className="pn">{p.name}</div>
                    <div className="pb">
                      <span><span className="pdot" style={{ background: "var(--green-ring)" }} />На линии <b>{p.on}</b></span>
                      <span><span className="pdot" style={{ background: "var(--red-ring)" }} />В простое <b>{p.idle}</b></span>
                    </div>
                  </Link>
                ))
              )}
            </div>

            <div className="grid" style={{ gridTemplateColumns: "1fr", alignContent: "start" }}>
              <Link
                href="/dashboard/drivers?f=debt"
                className="card hl"
                style={{
                  background: fleet.debtSum > 0 ? "linear-gradient(180deg,#fff,#fffafb)" : undefined,
                  borderColor: fleet.debtSum > 0 ? "#fbdfe5" : undefined,
                }}
              >
                <div className="card-title" style={{ color: fleet.debtSum > 0 ? "var(--red)" : undefined }}>
                  Дебиторская задолженность
                </div>
                {fleet.debtSum === 0 ? (
                  <div className="muted" style={{ fontSize: 13 }}>
                    Задолженности нет — все начисленные платежи закрыты.
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: "var(--red)" }}>{fleet.debtors.length}</div>
                      <div className="muted" style={{ fontSize: 12 }}>автомобилей</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: "var(--red)" }}>{rub(fleet.debtSum)}</div>
                      <div className="muted" style={{ fontSize: 12 }}>сумма долга</div>
                    </div>
                  </div>
                )}
              </Link>

              <div className="card">
                <div className="card-title">Требуют внимания</div>
                {attention.every((a) => a.n === 0) ? (
                  <div className="muted" style={{ fontSize: 13, padding: "6px 2px" }}>
                    Всё в порядке — событий, требующих внимания, нет.
                  </div>
                ) : (
                  attention.map((a, i) => {
                    const [bg, fg] = ATT_COLORS[a.c];
                    return (
                      <Link key={i} href={a.href} className="hl attention-row">
                        <div className="attention-ico" style={{ background: bg, color: fg }}>
                          <Icon name={a.icon} size={17} />
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{a.t}</div>
                        <div style={{ marginLeft: "auto", fontSize: 15, fontWeight: 800, color: a.n > 0 ? fg : "var(--muted)" }}>
                          {a.n}
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <IncomeDailyChart data={daily} />
        </div>
      </div>
    </>
  );
}
