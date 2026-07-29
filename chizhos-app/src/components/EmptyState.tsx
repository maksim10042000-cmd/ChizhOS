import type { ReactNode } from "react";
import Icon from "@/components/Icon";

/**
 * Единое оформление «данных пока нет».
 * Показывается вместо таблиц, карточек и графиков, пока в разделе пусто,
 * и всегда подсказывает следующий шаг.
 */
export default function EmptyState({
  icon = "file",
  title,
  hint,
  action,
  compact = false,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={"empty" + (compact ? " compact" : "")}>
      <div className="empty-ico">
        <Icon name={icon} size={compact ? 20 : 26} color="#9aa1ad" />
      </div>
      <div className="empty-title">{title}</div>
      {hint && <div className="empty-hint">{hint}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

/** Заглушка внутри карточки графика — сохраняет высоту, чтобы вёрстка не прыгала. */
export function ChartEmpty({
  title,
  hint = "График появится, как только появятся данные",
  height = 280,
}: {
  title: string;
  hint?: string;
  height?: number;
}) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      <div className="chart-empty" style={{ height }}>
        <Icon name="chart" size={26} color="#c3c8d0" />
        <div className="empty-title" style={{ marginTop: 10 }}>Нет данных для графика</div>
        <div className="empty-hint">{hint}</div>
      </div>
    </div>
  );
}
