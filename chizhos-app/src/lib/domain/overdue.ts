import type { Payment } from "@/lib/types";

/**
 * Количество дней просрочки = длина непрерывной цепочки неоплаченных платежей с конца.
 * Платежи упорядочены по возрастанию даты (последний = сегодня).
 */
export function overdueOf(payments: Payment[]): number {
  let od = 0;
  for (let k = payments.length - 1; k >= 0; k--) {
    if (!payments[k].paid) od++;
    else break;
  }
  return od;
}

export const lastPaid = (payments: Payment[]): boolean =>
  payments.length ? payments[payments.length - 1].paid : true;

export const discipline = (payments: Payment[]): number =>
  payments.length
    ? (payments.filter((p) => p.paid).length / payments.length) * 100
    : 100;
