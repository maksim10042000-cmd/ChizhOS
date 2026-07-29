"use client";

import { useState, type ReactNode } from "react";
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts";
import { ChartEmpty } from "@/components/EmptyState";
import { rub } from "@/lib/format";

/**
 * Графики ChizhOS на Recharts 3.
 *
 * Общие оси, подсказки и оболочка карточки вынесены в этот модуль,
 * чтобы у всех графиков был единый вид и одно место правки.
 *
 * Кастомное содержимое подсказки типизировано через `TooltipContentProps` —
 * это документированный тип Recharts 3 (в версии 2 назывался `TooltipProps`).
 */

/**
 * Компонент `Tooltip` в Recharts 3 объявлен без generic-параметров, поэтому
 * функция содержимого обязана принимать широкий тип значения
 * (`number | string | массив`). Приводим его к числу в одном месте.
 */
type MoneyTooltipProps = TooltipContentProps;

const toMoney = (v: TooltipValueType | undefined): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const AXIS_TICK = { fill: "#9aa1ad", fontSize: 11 } as const;
const CHART_HEIGHT = 280;

/** Крупные суммы на оси сокращаем: 12000 → «12k». */
const shortNumber = (v: number) => (v >= 1000 ? Math.round(v / 1000) + "k" : String(v));

/** Общие настройки осей — чтобы не повторять их в каждом графике. */
const xAxisProps = {
  tick: AXIS_TICK,
  tickLine: false,
  axisLine: false,
} as const;

const yAxisProps = {
  tick: AXIS_TICK,
  tickLine: false,
  axisLine: false,
  tickFormatter: shortNumber,
  width: 44,
} as const;

const gridProps = {
  stroke: "#f1f2f4",
  vertical: false,
} as const;

const chartMargin = { top: 8, right: 12, left: 4, bottom: 4 } as const;

// ---------------------------------------------------------------------------
// Оболочка карточки графика
// ---------------------------------------------------------------------------

function ChartCard({
  title,
  action,
  height = CHART_HEIGHT,
  children,
}: {
  title: string;
  action?: ReactNode;
  height?: number;
  children: ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-title">
        {title}
        {action}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Подсказки
// ---------------------------------------------------------------------------

function TipBox({ rows }: { rows: { label?: string; value: number; color?: string }[] }) {
  return (
    <div style={{ background: "#111827", color: "#fff", padding: "8px 11px", borderRadius: 9, fontSize: 12.5 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          {r.color && (
            <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, display: "inline-block" }} />
          )}
          {r.label ? r.label + ": " : ""}{rub(r.value)}
        </div>
      ))}
    </div>
  );
}

/** Подсказка с одним значением: «Доход: 12 500 ₽». */
function singleValueTooltip(label: string) {
  return function SingleValueTooltip({ active, payload }: MoneyTooltipProps): ReactNode {
    if (!active || !payload?.length) return null;
    return <TipBox rows={[{ label, value: toMoney(payload[0].value) }]} />;
  };
}

/** Подсказка со всеми сериями графика и их цветами. */
function AllSeriesTooltip({ active, payload }: MoneyTooltipProps): ReactNode {
  if (!active || !payload?.length) return null;
  return (
    <TipBox
      rows={payload.map((p) => ({
        label: p.name != null ? String(p.name) : undefined,
        value: toMoney(p.value),
        color: p.color,
      }))}
    />
  );
}

/** Подсказка для круговой диаграммы: название категории и сумма. */
function CategoryTooltip({ active, payload }: MoneyTooltipProps): ReactNode {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <TipBox rows={[{ label: item.name != null ? String(item.name) : undefined, value: toMoney(item.value) }]} />
  );
}

const incomeTooltip = singleValueTooltip("Доход");

// ---------------------------------------------------------------------------
// Доход по дням
// ---------------------------------------------------------------------------

const PERIODS: (number | "all")[] = [7, 30, 90, "all"];

export function IncomeDailyChart({ data }: { data: { label: string; income: number }[] }) {
  const [period, setPeriod] = useState<number | "all">(30);

  if (!data.some((d) => d.income > 0)) {
    return (
      <ChartEmpty
        title="Доход по дням"
        hint="Отметьте первый платёж по аренде — и здесь появится динамика дохода"
      />
    );
  }

  const sliced = period === "all" ? data : data.slice(-period);

  const periodSwitch = (
    <div style={{ display: "flex", gap: 2, background: "#eef0f3", padding: 3, borderRadius: 10 }}>
      {PERIODS.map((o) => (
        <button
          key={String(o)}
          onClick={() => setPeriod(o)}
          style={{
            padding: "5px 11px", borderRadius: 7, fontSize: 12.5, fontWeight: 600,
            color: period === o ? "var(--text)" : "var(--muted)",
            background: period === o ? "#fff" : "transparent",
            boxShadow: period === o ? "var(--shadow)" : "none",
          }}
        >
          {o === "all" ? "Год" : o + "д"}
        </button>
      ))}
    </div>
  );

  return (
    <ChartCard title="Доход по дням" action={periodSwitch}>
      <LineChart data={sliced} margin={chartMargin}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...xAxisProps} minTickGap={24} />
        <YAxis {...yAxisProps} />
        <Tooltip content={incomeTooltip} />
        <Line type="monotone" dataKey="income" stroke="#2563eb" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
      </LineChart>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Доход по месяцам
// ---------------------------------------------------------------------------

export function MonthlyBarChart({ data }: { data: { m: string; income: number }[] }) {
  if (!data.some((d) => d.income > 0)) {
    return <ChartEmpty title="Доход по месяцам" hint="Появится после первых оплаченных платежей" />;
  }

  return (
    <ChartCard title="Доход по месяцам">
      <BarChart data={data} margin={chartMargin}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="m" {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip cursor={{ fill: "#f3f4f6" }} content={incomeTooltip} />
        <Bar dataKey="income" fill="#2563eb" radius={[8, 8, 0, 0]} maxBarSize={46} />
      </BarChart>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Доход / расход / чистая прибыль
// ---------------------------------------------------------------------------

const PROFIT_SERIES = [
  { name: "Доход", dataKey: "income", stroke: "#16a34a", dashed: false },
  { name: "Расход", dataKey: "expense", stroke: "#e11d48", dashed: false },
  { name: "Чистая", dataKey: "net", stroke: "#2563eb", dashed: true },
] as const;

export function ProfitLineChart({
  data,
}: {
  data: { m: string; income: number; expense: number; net: number }[];
}) {
  if (!data.some((d) => d.income > 0 || d.expense > 0)) {
    return (
      <ChartEmpty
        title="Прибыль: доход / расход / чистая"
        hint="Появится, когда будут внесены платежи или расходы"
      />
    );
  }

  return (
    <ChartCard title="Прибыль: доход / расход / чистая">
      <LineChart data={data} margin={chartMargin}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="m" {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip content={AllSeriesTooltip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {PROFIT_SERIES.map((s) => (
          <Line
            key={s.dataKey}
            name={s.name}
            type="monotone"
            dataKey={s.dataKey}
            stroke={s.stroke}
            strokeWidth={2.5}
            strokeDasharray={s.dashed ? "6 4" : undefined}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Расходы по категориям
// ---------------------------------------------------------------------------

export function ExpensePie({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <ChartEmpty
        title="Расходы по категориям"
        hint="Добавьте первый расход — здесь появится разбивка по категориям"
        height={220}
      />
    );
  }

  // В легенде и на диаграмме показываем только непустые категории.
  const shown = data.filter((d) => d.value > 0);

  return (
    <div className="card">
      <div className="card-title">Расходы по категориям</div>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shown}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
            >
              {shown.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={CategoryTooltip} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
        {shown.map((d) => (
          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} />
            <span className="muted">{d.name}</span>
            <b style={{ marginLeft: "auto" }}>{rub(d.value)}</b>
          </div>
        ))}
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 6, display: "flex", fontSize: 12.5, fontWeight: 700 }}>
          <span>Итого</span><span style={{ marginLeft: "auto" }}>{rub(total)}</span>
        </div>
      </div>
    </div>
  );
}
