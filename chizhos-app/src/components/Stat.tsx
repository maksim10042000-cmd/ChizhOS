/**
 * Показатель. `delta` — изменение к предыдущему периоду в процентах.
 * null означает «сравнивать не с чем» — тогда строка динамики не рисуется,
 * вместо неё можно передать пояснение через `note`.
 */
export function Stat({
  label,
  value,
  delta,
  deltaLabel,
  note,
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  note?: string;
}) {
  const showDelta = delta != null && Number.isFinite(delta);
  const up = showDelta && delta! >= 0;

  return (
    <div className="stat hl">
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {showDelta ? (
        <div className={"d " + (up ? "up" : "down")}>
          {(up ? "↗ +" : "↘ ") + delta!.toFixed(1) + "%"}
          {deltaLabel ? " " + deltaLabel : ""}
        </div>
      ) : note ? (
        <div className="d muted">{note}</div>
      ) : null}
    </div>
  );
}

export function StatCircle({
  color,
  label,
  value,
  title,
  desc,
}: {
  color: "green" | "red";
  label: string;
  value: number;
  title: string;
  desc: string;
}) {
  return (
    <div className="status-circle hl">
      <div className={"ring " + color}>
        <span className="lbl">{label}</span>
        <span className="big">{value}</span>
      </div>
      <div className="sc-meta">
        <h3>{title}</h3>
        <p>{desc}</p>
      </div>
    </div>
  );
}
