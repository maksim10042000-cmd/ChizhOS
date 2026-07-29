import type { DerivedCar } from "@/lib/types";
import { discipline } from "./overdue";

export interface Kpi {
  onLinePct: number;
  avgRevenueDay: number;
  avgProfitMonth: number;
  costPerKm: number;
  avgRepair: number;
  /** Средняя выплата управляющему на автомобиль за месяц. */
  avgManagerPayMonth: number;
  /** Средняя прибыль владельца на автомобиль за месяц (после выплаты). */
  avgOwnerProfitMonth: number;
  /** Средневзвешенный процент управляющего по выручке. */
  effectivePercent: number;
  topCars: DerivedCar[];
  bottomCars: DerivedCar[];
  topDiscipline: { car: DerivedCar; value: number }[];
}

const EMPTY: Kpi = {
  onLinePct: 0,
  avgRevenueDay: 0,
  avgProfitMonth: 0,
  costPerKm: 0,
  avgRepair: 0,
  avgManagerPayMonth: 0,
  avgOwnerProfitMonth: 0,
  effectivePercent: 0,
  topCars: [],
  bottomCars: [],
  topDiscipline: [],
};

export function computeKpi(cars: DerivedCar[]): Kpi {
  if (cars.length === 0) return EMPTY;

  const n = cars.length;
  const onLinePct = (cars.filter((c) => c.status === "on").length / n) * 100;
  const avgRevenueDay = cars.reduce((s, c) => s + c.fin.income.today, 0) / n;
  const avgProfitMonth =
    cars.reduce((s, c) => s + (c.fin.income.month - c.fin.expMonth), 0) / n;

  const totalMile = cars.reduce((s, c) => s + c.mileMonth, 0);
  const totalExp = cars.reduce((s, c) => s + c.fin.expMonth, 0);
  const costPerKm = totalMile > 0 ? totalExp / totalMile : 0;
  const avgRepair = cars.reduce((s, c) => s + c.fin.expAll, 0) / n;

  const totalIncomeMonth = cars.reduce((s, c) => s + c.fin.income.month, 0);
  const totalManagerPay = cars.reduce((s, c) => s + c.fin.managerPayMonth, 0);
  const totalOwnerProfit = cars.reduce((s, c) => s + c.fin.ownerProfitMonth, 0);
  // Средневзвешенный процент: у автомобилей проценты разные,
  // поэтому усреднять сами проценты было бы неверно — считаем от выручки.
  const effectivePercent = totalIncomeMonth > 0 ? (totalManagerPay / totalIncomeMonth) * 100 : 0;

  const byProfit = [...cars].sort((a, b) => b.fin.profit - a.fin.profit);
  const topDiscipline = [...cars]
    .filter((c) => c.payments.length > 0)
    .map((car) => ({ car, value: discipline(car.payments) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return {
    onLinePct,
    avgRevenueDay,
    avgProfitMonth,
    costPerKm,
    avgRepair,
    avgManagerPayMonth: totalManagerPay / n,
    avgOwnerProfitMonth: totalOwnerProfit / n,
    effectivePercent,
    topCars: byProfit.slice(0, 5),
    // Пока автомобилей пять или меньше, «убыточные» — это те же самые машины,
    // что и «прибыльные». Показывать один и тот же список дважды бессмысленно.
    bottomCars: cars.length > 5 ? byProfit.slice(-5).reverse() : [],
    topDiscipline,
  };
}
