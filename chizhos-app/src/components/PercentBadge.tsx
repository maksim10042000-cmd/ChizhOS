import { MANAGER_SOURCE_LABELS, type ManagerPercentSource } from "@/lib/types";

/** Процент без лишних нулей: 10 → «10», 8.5 → «8,5». */
export function formatPercent(value: number): string {
  return String(Number(value.toFixed(2))).replace(".", ",");
}

/**
 * Отметка источника процента управляющего.
 * Индивидуальный выделен цветом, чтобы такие автомобили было видно в списке.
 */
export default function PercentBadge({
  source,
  percent,
  withValue = false,
}: {
  source: ManagerPercentSource;
  percent?: number;
  withValue?: boolean;
}) {
  const own = source === "own";
  return (
    <span
      className={"pct-badge" + (own ? " own" : "")}
      title={
        own
          ? "Задан индивидуальный процент для этого автомобиля"
          : "Используется общий процент автопарка"
      }
    >
      {own && <span className="pct-dot" aria-hidden="true" />}
      {withValue && percent != null ? `${formatPercent(percent)}% · ` : ""}
      {MANAGER_SOURCE_LABELS[source]}
    </span>
  );
}
