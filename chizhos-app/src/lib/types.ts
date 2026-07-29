// Доменные типы приложения. Соответствуют моделям prisma/schema.prisma.
// Файл не импортирует серверных модулей — используется и на клиенте, и на сервере.

export type ExpenseCat =
  | "to"
  | "parts"
  | "wash"
  | "tire"
  | "insurance"
  | "fine"
  | "other";

export const EXPENSE_CATS: Record<ExpenseCat, string> = {
  to: "ТО",
  parts: "Запчасти",
  wash: "Мойка",
  tire: "Шиномонтаж",
  insurance: "Страховка",
  fine: "Штрафы",
  other: "Прочее",
};

export const EXPENSE_COLORS: Record<ExpenseCat, string> = {
  to: "#2563eb",
  parts: "#7c3aed",
  wash: "#06b6d4",
  tire: "#f59e0b",
  insurance: "#10b981",
  fine: "#ef4444",
  other: "#94a3b8",
};

export const PAYMENT_METHODS = ["Наличные", "Карта", "Перевод"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type CarStatus = "on" | "idle";

// ---------------------------------------------------------------------------
// Роли и разделы
// ---------------------------------------------------------------------------

/**
 * admin   — Administrator: полный доступ ко всем паркам и администрированию.
 * manager — Park Manager: полный доступ к разделам, но только внутри своего парка.
 * user    — User: только свой парк и только разрешённые администратором разделы.
 */
export type Role = "admin" | "manager" | "user";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Администратор",
  manager: "Менеджер парка",
  user: "Пользователь",
};

export const ROLE_HINTS: Record<Role, string> = {
  admin: "Все парки, управление пользователями и настройками",
  manager: "Все разделы, но только в пределах своего парка",
  user: "Свой парк и только разрешённые разделы",
};

export type Section =
  | "dashboard"
  | "cars"
  | "drivers"
  | "finance"
  | "expenses"
  | "calendar"
  | "analytics"
  | "notifications";

export const SECTIONS: { key: Section; label: string; href: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "dash" },
  { key: "cars", label: "Автомобили", href: "/dashboard/cars", icon: "car" },
  { key: "drivers", label: "Водители", href: "/dashboard/drivers", icon: "users" },
  { key: "finance", label: "Финансы", href: "/dashboard/finance", icon: "money" },
  { key: "expenses", label: "Расходы", href: "/dashboard/expenses", icon: "receipt" },
  { key: "calendar", label: "Календарь", href: "/dashboard/calendar", icon: "cal" },
  { key: "analytics", label: "Аналитика (KPI)", href: "/dashboard/analytics", icon: "chart" },
  { key: "notifications", label: "Уведомления", href: "/dashboard/notifications", icon: "bell" },
];

export const ALL_SECTIONS: Section[] = SECTIONS.map((s) => s.key);

/** Разделы, выдаваемые роли user по умолчанию (если права не настроены отдельно). */
export const DEFAULT_USER_SECTIONS: Section[] = [
  "dashboard",
  "cars",
  "drivers",
  "notifications",
];

/** Итоговый список доступных разделов для роли и персональных прав. */
export function sectionsFor(role: Role, permissions: Section[]): Section[] {
  if (role === "admin" || role === "manager") return ALL_SECTIONS;
  return permissions.length ? permissions : DEFAULT_USER_SECTIONS;
}

export interface Session {
  userId: string;
  login: string;
  name: string;
  role: Role;
  /** Парк пользователя. У администратора — null (видит все парки). */
  parkId: string | null;
  permissions: Section[];
}

// ---------------------------------------------------------------------------
// Сущности
// ---------------------------------------------------------------------------

export interface Park {
  id: string;
  name: string;
}

export interface AppUser {
  id: string;
  login: string;
  name: string;
  role: Role;
  parkId: string | null;
  blocked: boolean;
  permissions: Section[];
  createdAt: string;
}

export interface Payment {
  id: string;
  date: Date;
  amount: number;
  paid: boolean;
  paidAt: Date | null;
  method: string;
}

export interface Expense {
  id: string;
  cat: ExpenseCat;
  name: string;
  amount: number;
  date: Date;
  comment?: string;
  carId?: string | null;
  parkId?: string | null;
}

export type DocKind = "vehicle" | "driver";

export interface Doc {
  id: string;
  name: string;
  url: string; // /uploads/... либо публичный URL S3/R2
  mime?: string;
  size?: number;
  docType?: string; // СТС, ПТС, Договор, Полис, Диагностическая карта…
  uploadedAt: string; // ISO
}

export interface DocMeta {
  name: string;
  url: string;
  mime?: string;
  size?: number;
  docType?: string;
}

export interface Car {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  parkId: string;
  status: CarStatus;
  driverId: string | null;
  /** ФИО закреплённого водителя либо пустая строка. */
  driver: string;
  /** Телефон закреплённого водителя либо пустая строка. */
  phone: string;
  mileage: number;
  rate: number;
  mileMonth: number;
  /**
   * Индивидуальный процент управляющего.
   * null — не задан, используется общий процент автопарка.
   */
  managerPercent: number | null;
  payments: Payment[];
  expenses: Expense[];
  docs: Doc[];
  driverDocs: Doc[];
  /**
   * Производные поля, вычисляемые из insuranceUntil / nextServiceKm.
   * null означает «данные не заданы» — предупреждение не показывается.
   */
  insuranceDays: number | null;
  toRemainingKm: number | null;
  toSoon: boolean;
}

/** Откуда взят процент управляющего для автомобиля. */
export type ManagerPercentSource = "own" | "default";

export const MANAGER_SOURCE_LABELS: Record<ManagerPercentSource, string> = {
  own: "Индивидуальный",
  default: "По умолчанию",
};

export interface CarFinance {
  income: { today: number; week: number; month: number; all: number };
  expAll: number;
  expMonth: number;
  profit: number;
  roi: number;
  perKm: number;
  debt: number;
  avgDay: number;

  /** Применённый процент управляющего и его происхождение. */
  managerPercent: number;
  managerPercentSource: ManagerPercentSource;
  /** Выплата управляющему за месяц и за всё время. */
  managerPayMonth: number;
  managerPayAll: number;
  /** Прибыль владельца — то, что остаётся после выплаты управляющему. */
  ownerProfitMonth: number;
  ownerProfitAll: number;
}

export interface DerivedCar extends Car {
  overdue: number;
  fin: CarFinance;
}

export interface Driver {
  id: string;
  fullName: string;
  phone: string;
  parkId: string | null;
  licenseNo: string;
  passport: string;
  address: string;
  deposit: number;
  comment: string;
  active: boolean;
  createdAt: string;
  /** Закреплённые автомобили (госномера). */
  carPlates: string[];
  docs: Doc[];
}

export type Severity = "critical" | "warning" | "info";

export interface AppNotification {
  id: string;
  type: string;
  severity: Severity;
  title: string;
  body: string;
  carId?: string;
}
