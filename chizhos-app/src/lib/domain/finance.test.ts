import { describe, it, expect } from "vitest";
import {
  carFinance,
  computeFleet,
  managerSplit,
  deltaPct,
  clampPercent,
  effectiveManagerPercent,
} from "./finance";
import { overdueOf, discipline } from "./overdue";
import { buildNotifications, notifCounts } from "./notifications";
import { computeKpi } from "./kpi";
import type { Car, DerivedCar, Expense, Park, Payment } from "@/lib/types";

// Фиксированная точка отсчёта: тесты не должны зависеть от текущей даты.
const NOW = new Date(2026, 6, 16, 12, 0, 0);
const day = (offset: number) => new Date(NOW.getTime() - offset * 86_400_000);

let seq = 0;
function pay(offset: number, paid: boolean, amount = 1000): Payment {
  const d = day(offset);
  return { id: "p" + seq++, date: d, amount, paid, paidAt: paid ? d : null, method: "Карта" };
}

function expense(offset: number, amount: number, cat: Expense["cat"] = "parts"): Expense {
  return { id: "e" + seq++, cat, name: "Расход", amount, date: day(offset) };
}

function makeCar(over: Partial<Car> = {}): Car {
  return {
    id: "c1", plate: "А001АА 177", brand: "Kia", model: "K5", year: 2022,
    parkId: "p1", status: "on", driverId: "d1", driver: "Иванов И.И.",
    phone: "+7 900 000-00-00",
    mileage: 100000, rate: 1000, mileMonth: 3000,
    managerPercent: null,
    payments: [pay(2, true), pay(1, true), pay(0, true)],
    expenses: [], docs: [], driverDocs: [],
    insuranceDays: 200, toRemainingKm: 5000, toSoon: false,
    ...over,
  };
}

const parks: Park[] = [{ id: "p1", name: "Парк №1" }, { id: "p2", name: "Парк №2" }];

describe("overdueOf", () => {
  it("считает непрерывную цепочку неоплаченных с конца", () => {
    expect(overdueOf([pay(3, true), pay(2, false), pay(1, false), pay(0, false)])).toBe(3);
    expect(overdueOf([pay(2, false), pay(1, true), pay(0, false)])).toBe(1);
    expect(overdueOf([pay(1, true), pay(0, true)])).toBe(0);
  });
  it("пустой список — 0", () => {
    expect(overdueOf([])).toBe(0);
  });
});

describe("carFinance", () => {
  it("суммирует доход по оплаченным платежам", () => {
    const f = carFinance(makeCar(), NOW);
    expect(f.income.all).toBe(3000);
    expect(f.income.today).toBe(1000);
  });
  it("неоплаченные платежи формируют долг, но не доход", () => {
    const f = carFinance(makeCar({ payments: [pay(1, false), pay(0, false)] }), NOW);
    expect(f.income.all).toBe(0);
    expect(f.debt).toBe(2000);
  });
  it("деление на ноль защищено", () => {
    const f = carFinance(makeCar({ mileMonth: 0, expenses: [], payments: [] }), NOW);
    expect(f.perKm).toBe(0);
    expect(f.roi).toBe(0);
    expect(f.profit).toBe(0);
  });
});

describe("computeFleet", () => {
  it("считает on/idle и агрегаты", () => {
    const cars: Car[] = [
      makeCar({ id: "c1", status: "on" }),
      makeCar({ id: "c2", status: "idle" }),
    ];
    const fleet = computeFleet(cars, parks, [], NOW);
    expect(fleet.onLine).toBe(1);
    expect(fleet.idle).toBe(1);
    expect(fleet.incToday).toBe(2000);
    expect(fleet.parkName("p1")).toBe("Парк №1");
    expect(fleet.parkName("nope")).toBe("—");
  });

  it("должники определяются по просрочке", () => {
    const debtor = makeCar({ id: "d", payments: [pay(1, false), pay(0, false)] });
    const fleet = computeFleet([debtor], parks, [], NOW);
    expect(fleet.debtors.length).toBe(1);
    expect(fleet.cars[0].overdue).toBe(2);
    expect(fleet.debtSum).toBe(2000);
  });

  it("пустая система: нули вместо ошибок", () => {
    const fleet = computeFleet([], [], [], NOW);
    expect(fleet.cars).toEqual([]);
    expect(fleet.onLine).toBe(0);
    expect(fleet.incMonth).toBe(0);
    expect(fleet.profit).toBe(0);
    expect(fleet.debtSum).toBe(0);
    expect(fleet.hasFinanceData).toBe(false);
    // График всё равно строится — 180 точек с нулями.
    expect(fleet.series.length).toBe(180);
    expect(fleet.series.every((s) => s.income === 0)).toBe(true);
  });

  it("разделяет текущий и предыдущий периоды", () => {
    const car = makeCar({
      payments: [pay(40, true, 500), pay(10, true, 700), pay(0, true, 300)],
    });
    const fleet = computeFleet([car], parks, [], NOW);
    expect(fleet.incMonth).toBe(1000);      // 700 + 300 за последние 30 дней
    expect(fleet.incPrevMonth).toBe(500);   // 500 в окне 30–60 дней назад
  });

  it("общие расходы попадают в расход месяца", () => {
    const gen: Expense[] = [expense(5, 2000, "insurance")];
    const fleet = computeFleet([makeCar({ payments: [] })], parks, gen, NOW);
    expect(fleet.expMonth).toBe(2000);
    expect(fleet.brk.insurance).toBe(2000);
    expect(fleet.hasFinanceData).toBe(true);
  });
});

describe("deltaPct", () => {
  it("считает изменение к предыдущему периоду", () => {
    expect(deltaPct(120, 100)).toBeCloseTo(20);
    expect(deltaPct(80, 100)).toBeCloseTo(-20);
  });
  it("возвращает null, если сравнивать не с чем", () => {
    // Рост «с нуля» в процентах не выражается — показывать «+100%» было бы враньём.
    expect(deltaPct(500, 0)).toBeNull();
  });
});

describe("процент управляющего: наследование", () => {
  it("собственный процент автомобиля имеет приоритет над общим", () => {
    expect(effectiveManagerPercent({ managerPercent: 8.5 }, 10)).toEqual({
      percent: 8.5,
      source: "own",
    });
  });

  it("без собственного процента берётся общий", () => {
    expect(effectiveManagerPercent({ managerPercent: null }, 12.5)).toEqual({
      percent: 12.5,
      source: "default",
    });
  });

  it("ноль — это заданное значение, а не «не задано»", () => {
    expect(effectiveManagerPercent({ managerPercent: 0 }, 10)).toEqual({
      percent: 0,
      source: "own",
    });
  });

  it("значения вне диапазона приводятся к 0..100", () => {
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(8.5)).toBe(8.5);
    expect(clampPercent(Number.NaN)).toBe(0);
  });
});

describe("carFinance: выплата управляющему и прибыль владельца", () => {
  it("считает выплату по общему проценту", () => {
    // Доход 3000 за месяц, процент 10 → выплата 300.
    const f = carFinance(makeCar(), NOW, 10);
    expect(f.managerPercent).toBe(10);
    expect(f.managerPercentSource).toBe("default");
    expect(f.managerPayMonth).toBe(300);
    expect(f.ownerProfitMonth).toBe(2700);
  });

  it("индивидуальный процент перекрывает общий", () => {
    const f = carFinance(makeCar({ managerPercent: 20 }), NOW, 10);
    expect(f.managerPercentSource).toBe("own");
    expect(f.managerPayMonth).toBe(600);
    expect(f.ownerProfitMonth).toBe(2400);
  });

  it("поддерживает дробный процент", () => {
    // 3000 × 8.5% = 255
    const f = carFinance(makeCar({ managerPercent: 8.5 }), NOW, 10);
    expect(f.managerPayMonth).toBe(255);
  });

  it("расходы уменьшают прибыль владельца, но не выплату управляющему", () => {
    const f = carFinance(makeCar({ expenses: [expense(1, 500)] }), NOW, 10);
    expect(f.managerPayMonth).toBe(300); // процент считается от выручки
    expect(f.ownerProfitMonth).toBe(3000 - 500 - 300);
  });
});

describe("computeFleet: агрегат с разными процентами", () => {
  it("складывает выплаты по автомобилям, а не умножает общий доход на одну ставку", () => {
    const cars: Car[] = [
      makeCar({ id: "a", managerPercent: 20 }), // 3000 → 600
      makeCar({ id: "b", managerPercent: null }), // 3000 → 10% = 300
    ];
    const fleet = computeFleet(cars, parks, [], NOW, 10);

    expect(fleet.incMonth).toBe(6000);
    expect(fleet.managerPay).toBe(900);
    // Наивный расчёт «весь доход × общий процент» дал бы 600 — это и была бы ошибка.
    expect(fleet.managerPay).not.toBe(600);
    expect(fleet.ownerProfit).toBe(fleet.profit - 900);
    expect(fleet.carsWithOwnPercent).toBe(1);
    expect(fleet.globalManagerPercent).toBe(10);
  });

  it("изменение общего процента пересчитывает только наследующие автомобили", () => {
    const cars: Car[] = [
      makeCar({ id: "a", managerPercent: 20 }),
      makeCar({ id: "b", managerPercent: null }),
    ];
    const at10 = computeFleet(cars, parks, [], NOW, 10);
    const at50 = computeFleet(cars, parks, [], NOW, 50);

    expect(at10.managerPay).toBe(900); // 600 + 300
    expect(at50.managerPay).toBe(2100); // 600 + 1500
    // Автомобиль со своим процентом не изменился.
    expect(at50.cars[0].fin.managerPayMonth).toBe(600);
  });

  it("на пустом парке выплата и прибыль владельца равны нулю", () => {
    const fleet = computeFleet([], [], [], NOW, 10);
    expect(fleet.managerPay).toBe(0);
    expect(fleet.ownerProfit).toBe(0);
    expect(fleet.carsWithOwnPercent).toBe(0);
  });
});

describe("managerSplit", () => {
  it("считает выплату и остаток", () => {
    expect(managerSplit(500000, 10)).toMatchObject({ managerPay: 50000, remainder: 450000 });
  });
  it("ограничивает процент диапазоном 0..100", () => {
    expect(managerSplit(1000, 150).managerPay).toBe(1000);
    expect(managerSplit(1000, -5).managerPay).toBe(0);
  });
});

describe("discipline", () => {
  it("доля оплаченных платежей", () => {
    expect(discipline([pay(1, true), pay(0, false)])).toBe(50);
    expect(discipline([])).toBe(100);
  });
});

describe("buildNotifications", () => {
  const derive = (over: Partial<Car>): DerivedCar[] =>
    computeFleet([makeCar(over)], parks, [], NOW).cars;

  it("не выдумывает предупреждения, если данные не заполнены", () => {
    // Страховка и ТО не указаны — предупреждать не о чем.
    const cars = derive({ insuranceDays: null, toRemainingKm: null, toSoon: false });
    expect(buildNotifications(cars)).toEqual([]);
  });

  it("сообщает о просрочке, простое, ТО и страховке", () => {
    const cars = derive({
      status: "idle",
      payments: [pay(1, false), pay(0, false)],
      insuranceDays: 10,
      toRemainingKm: 300,
      toSoon: true,
    });
    const types = buildNotifications(cars).map((n) => n.type).sort();
    expect(types).toEqual(["idle", "insurance", "overdue", "to_soon"]);
  });

  it("скрытые уведомления не считаются", () => {
    const cars = derive({ status: "idle", insuranceDays: null, toRemainingKm: null });
    const all = buildNotifications(cars);
    expect(notifCounts(cars).warning).toBe(1);
    expect(notifCounts(cars, [all[0].id]).warning).toBe(0);
  });
});

describe("computeKpi", () => {
  it("на пустом парке возвращает нули, а не NaN", () => {
    const kpi = computeKpi([]);
    expect(kpi.onLinePct).toBe(0);
    expect(kpi.costPerKm).toBe(0);
    expect(kpi.avgRevenueDay).toBe(0);
    expect(kpi.topCars).toEqual([]);
    expect(kpi.bottomCars).toEqual([]);
  });

  it("не дублирует список, пока автомобилей мало", () => {
    const cars = computeFleet([makeCar()], parks, [], NOW).cars;
    const kpi = computeKpi(cars);
    expect(kpi.topCars.length).toBe(1);
    // Один и тот же автомобиль не должен быть одновременно самым
    // прибыльным и самым убыточным.
    expect(kpi.bottomCars).toEqual([]);
  });
});
