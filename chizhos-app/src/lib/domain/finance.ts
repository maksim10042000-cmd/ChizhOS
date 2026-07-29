import type {
  Car,
  CarFinance,
  DerivedCar,
  Expense,
  ManagerPercentSource,
  Park,
} from "@/lib/types";
import { DAY } from "@/lib/format";
import { overdueOf } from "./overdue";

/** Процент управляющего при самой первой установке системы. */
export const DEFAULT_MANAGER_PERCENT = 10;

/** Приводит процент в диапазон 0..100. Дробные значения сохраняются. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * Какой процент управляющего действует для автомобиля.
 *
 * Правило наследования: собственный процент автомобиля имеет приоритет,
 * а если он не задан (null) — берётся общий процент автопарка.
 */
export function effectiveManagerPercent(
  car: Pick<Car, "managerPercent">,
  globalPercent: number
): { percent: number; source: ManagerPercentSource } {
  if (car.managerPercent != null) {
    return { percent: clampPercent(car.managerPercent), source: "own" };
  }
  return { percent: clampPercent(globalPercent), source: "default" };
}

/** Выплата управляющему от суммы выручки. */
const payFrom = (revenue: number, percent: number) => Math.round((revenue * percent) / 100);

/**
 * «Возраст» даты в днях относительно точки отсчёта.
 * Отрицательный — дата в будущем.
 */
const ageDays = (dt: Date, now: number) => (now - dt.getTime()) / DAY;

/** Попадает ли дата в окно [from; to) дней назад. */
const inWindow = (dt: Date, now: number, from: number, to: number) => {
  const a = ageDays(dt, now);
  return a >= from && a < to;
};

/**
 * Финансовые показатели одного автомобиля (чистая функция).
 * `globalManagerPercent` — общий процент автопарка, применяется, если
 * у автомобиля не задан собственный.
 */
export function carFinance(
  car: Car,
  today: Date,
  globalManagerPercent: number = DEFAULT_MANAGER_PERCENT
): CarFinance {
  const now = today.getTime();

  const paid = car.payments.filter((p) => p.paid);
  const income = { today: 0, week: 0, month: 0, all: 0 };
  for (const p of paid) {
    income.all += p.amount;
    if (inWindow(p.date, now, 0, 1)) income.today += p.amount;
    if (inWindow(p.date, now, 0, 7)) income.week += p.amount;
    if (inWindow(p.date, now, 0, 30)) income.month += p.amount;
  }

  const expAll = car.expenses.reduce((s, e) => s + e.amount, 0);
  const expMonth = car.expenses
    .filter((e) => inWindow(e.date, now, 0, 30))
    .reduce((s, e) => s + e.amount, 0);

  const profit = income.all - expAll;
  const roi = income.all ? (profit / income.all) * 100 : 0;
  const perKm = car.mileMonth ? (income.month - expMonth) / car.mileMonth : 0;
  const debt = car.payments.filter((p) => !p.paid).reduce((s, p) => s + p.amount, 0);

  // Управляющий получает процент от выручки автомобиля,
  // владельцу остаётся прибыль за вычетом этой выплаты.
  const { percent, source } = effectiveManagerPercent(car, globalManagerPercent);
  const managerPayMonth = payFrom(income.month, percent);
  const managerPayAll = payFrom(income.all, percent);

  return {
    income,
    expAll,
    expMonth,
    profit,
    roi,
    perKm,
    debt,
    avgDay: Math.round(car.mileMonth / 30),
    managerPercent: percent,
    managerPercentSource: source,
    managerPayMonth,
    managerPayAll,
    ownerProfitMonth: income.month - expMonth - managerPayMonth,
    ownerProfitAll: profit - managerPayAll,
  };
}

/**
 * Изменение показателя к предыдущему периоду, %.
 * null — если сравнивать не с чем (в прошлом периоде было 0):
 * рост «с нуля» в процентах не выражается, и рисовать «+100%» нечестно.
 */
export function deltaPct(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export interface Fleet {
  cars: DerivedCar[];
  parks: (Park & { on: number; idle: number })[];
  parkName: (id: string) => string;
  onLine: number;
  idle: number;
  incToday: number;
  incWeek: number;
  incMonth: number;
  /** Предыдущие периоды — для честного расчёта динамики. */
  incYesterday: number;
  incPrevWeek: number;
  incPrevMonth: number;
  expMonth: number;
  expPrevMonth: number;
  profit: number;
  prevProfit: number;

  /** Общий процент автопарка — от него наследуются автомобили без своего. */
  globalManagerPercent: number;
  /**
   * Выплата управляющему за месяц. Считается суммой по автомобилям,
   * потому что у каждого может быть свой процент — умножить общий доход
   * на одну ставку было бы неверно.
   */
  managerPay: number;
  /** Прибыль владельца за месяц: чистая прибыль минус выплата управляющему. */
  ownerProfit: number;
  /** Сколько автомобилей используют индивидуальный процент. */
  carsWithOwnPercent: number;
  debtors: DerivedCar[];
  debtSum: number;
  brk: Record<string, number>;
  series: { date: Date; income: number }[];
  monthly: { m: string; income: number; expense: number }[];
  generalExpenses: Expense[];
  /** Есть ли вообще платежи или расходы — по этому флагу рисуются пустые состояния. */
  hasFinanceData: boolean;
}

const MONTH_RU = [
  "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
  "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
];

/** Полный агрегат автопарка из «сырых» данных. */
export function computeFleet(
  rawCars: Car[],
  parksArr: Park[],
  genEx: Expense[] = [],
  today: Date = new Date(),
  globalManagerPercent: number = DEFAULT_MANAGER_PERCENT
): Fleet {
  const now = today.getTime();
  const globalPercent = clampPercent(globalManagerPercent);

  const cars: DerivedCar[] = rawCars.map((c) => ({
    ...c,
    overdue: overdueOf(c.payments),
    fin: carFinance(c, today, globalPercent),
  }));

  const onLine = cars.filter((c) => c.status === "on").length;
  const idle = cars.length - onLine;
  const parks = parksArr.map((p) => ({
    ...p,
    on: cars.filter((c) => c.parkId === p.id && c.status === "on").length,
    idle: cars.filter((c) => c.parkId === p.id && c.status === "idle").length,
  }));
  const parkName = (id: string) => parksArr.find((x) => x.id === id)?.name ?? "—";

  const incToday = cars.reduce((s, c) => s + c.fin.income.today, 0);
  const incWeek = cars.reduce((s, c) => s + c.fin.income.week, 0);
  const incMonth = cars.reduce((s, c) => s + c.fin.income.month, 0);

  // Доход в предыдущих окнах — по всем оплаченным платежам всех авто.
  const sumPaidIn = (from: number, to: number) =>
    cars.reduce(
      (s, c) =>
        s +
        c.payments
          .filter((p) => p.paid && inWindow(p.date, now, from, to))
          .reduce((a, p) => a + p.amount, 0),
      0
    );
  const incYesterday = sumPaidIn(1, 2);
  const incPrevWeek = sumPaidIn(7, 14);
  const incPrevMonth = sumPaidIn(30, 60);

  const carExpIn = (from: number, to: number) =>
    cars.reduce(
      (s, c) => s + c.expenses.filter((e) => inWindow(e.date, now, from, to)).reduce((a, e) => a + e.amount, 0),
      0
    );
  const genExpIn = (from: number, to: number) =>
    genEx.filter((e) => inWindow(e.date, now, from, to)).reduce((s, e) => s + e.amount, 0);

  const expMonth = carExpIn(0, 30) + genExpIn(0, 30);
  const expPrevMonth = carExpIn(30, 60) + genExpIn(30, 60);

  const debtors = cars.filter((c) => c.overdue > 0);
  const debtSum = cars.reduce((s, c) => s + c.fin.debt, 0);

  const brk: Record<string, number> = {
    to: 0, parts: 0, wash: 0, tire: 0, insurance: 0, fine: 0, other: 0,
  };
  cars.forEach((c) =>
    c.expenses.forEach((e) => {
      if (inWindow(e.date, now, 0, 30)) brk[e.cat] = (brk[e.cat] ?? 0) + e.amount;
    })
  );
  genEx.forEach((e) => {
    if (inWindow(e.date, now, 0, 30)) brk[e.cat] = (brk[e.cat] ?? 0) + e.amount;
  });

  // Ежедневная выручка за 180 дней
  const dayIncome: Record<string, number> = {};
  cars.forEach((c) =>
    c.payments.forEach((p) => {
      if (p.paid) {
        const key = p.date.toDateString();
        dayIncome[key] = (dayIncome[key] ?? 0) + p.amount;
      }
    })
  );
  const series: { date: Date; income: number }[] = [];
  for (let d = 179; d >= 0; d--) {
    const dt = new Date(now - d * DAY);
    series.push({ date: dt, income: dayIncome[dt.toDateString()] ?? 0 });
  }

  // Месячные показатели (6 мес)
  const mMap: Record<string, { m: string; income: number; expense: number }> = {};
  const order: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${dt.getFullYear()}-${dt.getMonth()}`;
    order.push(key);
    mMap[key] = { m: MONTH_RU[dt.getMonth()], income: 0, expense: 0 };
  }
  cars.forEach((c) => {
    c.payments.forEach((p) => {
      if (p.paid) {
        const k = `${p.date.getFullYear()}-${p.date.getMonth()}`;
        if (mMap[k]) mMap[k].income += p.amount;
      }
    });
    c.expenses.forEach((e) => {
      const k = `${e.date.getFullYear()}-${e.date.getMonth()}`;
      if (mMap[k]) mMap[k].expense += e.amount;
    });
  });
  genEx.forEach((e) => {
    const k = `${e.date.getFullYear()}-${e.date.getMonth()}`;
    if (mMap[k]) mMap[k].expense += e.amount;
  });
  const monthly = order.map((k) => mMap[k]);

  const hasFinanceData =
    cars.some((c) => c.payments.length > 0 || c.expenses.length > 0) || genEx.length > 0;

  const profit = incMonth - expMonth;
  const managerPay = cars.reduce((s, c) => s + c.fin.managerPayMonth, 0);
  const carsWithOwnPercent = cars.filter((c) => c.fin.managerPercentSource === "own").length;

  return {
    cars, parks, parkName, onLine, idle,
    incToday, incWeek, incMonth,
    incYesterday, incPrevWeek, incPrevMonth,
    expMonth, expPrevMonth,
    profit,
    prevProfit: incPrevMonth - expPrevMonth,
    globalManagerPercent: globalPercent,
    managerPay,
    ownerProfit: profit - managerPay,
    carsWithOwnPercent,
    debtors, debtSum, brk, series, monthly,
    generalExpenses: genEx,
    hasFinanceData,
  };
}

/** Расчёт управляющего. */
export function managerSplit(revenue: number, percent: number) {
  const pct = Math.max(0, Math.min(100, percent || 0));
  const pay = Math.round((revenue * pct) / 100);
  return { revenue, percent: pct, managerPay: pay, remainder: revenue - pay };
}
