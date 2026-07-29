const nf = new Intl.NumberFormat("ru-RU");

export const fmt = (n: number) => nf.format(Math.round(n));
export const rub = (n: number) => fmt(n) + " ₽";
export const km = (n: number) => fmt(n) + " км";
export const pct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(1) + "%";

export const DAY = 86_400_000;

/**
 * Текущая дата. Функция, а не константа: серверный процесс живёт неделями,
 * и значение, вычисленное при импорте модуля, «замёрзло» бы на дате запуска.
 */
export const today = () => new Date();

/** Дата в формате YYYY-MM-DD для полей <input type="date">. */
export const isoDate = (d: Date = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Начало суток — чтобы сравнения «сегодня» не зависели от времени. */
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
