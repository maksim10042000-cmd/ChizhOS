import type { AppNotification, DerivedCar, Severity } from "@/lib/types";

/** Порог «страховка заканчивается», дней. */
export const INSURANCE_SOON_DAYS = 30;

const carLabel = (c: DerivedCar) => `${c.brand} ${c.model} • ${c.plate}`.trim();
const driverLabel = (c: DerivedCar) => c.driver || "водитель не назначен";

/**
 * Единый источник уведомлений: используется и списком, и счётчиками.
 * Уведомления строятся только из заполненных данных — если у авто не указана
 * дата страховки или пробег следующего ТО, предупреждение не выдумывается.
 */
export function buildNotifications(cars: DerivedCar[]): AppNotification[] {
  const all: AppNotification[] = [];

  cars
    .filter((c) => c.overdue > 0)
    .forEach((c) =>
      all.push({
        id: "ov_" + c.id,
        type: "overdue",
        severity: "critical",
        title: "Просрочена аренда",
        body: `${driverLabel(c)} • ${carLabel(c)} • просрочка ${c.overdue} дн.`,
        carId: c.id,
      })
    );

  cars
    .filter((c) => c.toSoon && c.toRemainingKm != null)
    .forEach((c) =>
      all.push({
        id: "to_" + c.id,
        type: "to_soon",
        severity: "warning",
        title: "Приближается ТО",
        body:
          c.toRemainingKm! >= 0
            ? `${carLabel(c)} • через ${c.toRemainingKm} км`
            : `${carLabel(c)} • ТО просрочено на ${Math.abs(c.toRemainingKm!)} км`,
        carId: c.id,
      })
    );

  cars
    .filter((c) => c.insuranceDays != null && c.insuranceDays < INSURANCE_SOON_DAYS)
    .forEach((c) =>
      all.push({
        id: "ins_" + c.id,
        type: "insurance",
        severity: "warning",
        title: c.insuranceDays! < 0 ? "Страховка истекла" : "Заканчивается страховка",
        body:
          c.insuranceDays! < 0
            ? `${carLabel(c)} • истекла ${Math.abs(c.insuranceDays!)} дн. назад`
            : `${carLabel(c)} • осталось ${c.insuranceDays} дн.`,
        carId: c.id,
      })
    );

  cars
    .filter((c) => c.status === "idle")
    .forEach((c) =>
      all.push({
        id: "idle_" + c.id,
        type: "idle",
        severity: "warning",
        title: "Автомобиль в простое",
        body: carLabel(c),
        carId: c.id,
      })
    );

  return all;
}

export function notifCounts(
  cars: DerivedCar[],
  dismissed: string[] = []
): Record<Severity, number> {
  const c: Record<Severity, number> = { critical: 0, warning: 0, info: 0 };
  for (const n of buildNotifications(cars)) {
    if (!dismissed.includes(n.id)) c[n.severity]++;
  }
  return c;
}
