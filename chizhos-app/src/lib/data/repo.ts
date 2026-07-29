import { prisma } from "@/lib/prisma";
import { clampPercent, computeFleet, type Fleet } from "@/lib/domain/finance";
import { overdueOf } from "@/lib/domain/overdue";
import { DAY, today } from "@/lib/format";
import { hashPassword } from "@/lib/auth";
import { parsePermissions, serializePermissions } from "@/lib/session";
import { EXPENSE_CATS } from "@/lib/types";
import type {
  AppUser,
  Car,
  CarStatus,
  Doc,
  DocKind,
  DocMeta,
  Driver,
  Expense,
  ExpenseCat,
  Park,
  Payment,
  Role,
  Section,
  Session,
} from "@/lib/types";

/**
 * Слой доступа к данным. Единственное место, которое знает о Prisma:
 * страницы и server actions работают только с доменными типами.
 *
 * Разграничение доступа реализовано здесь, «на уровне данных»: выборки
 * сужаются под парк пользователя, поэтому UI не может показать чужой парк
 * даже по ошибке.
 */

// Порог «скоро ТО» и «заканчивается страховка».
const SERVICE_SOON_KM = 1000;
export const INSURANCE_SOON_DAYS = 30;

// ---------------------------------------------------------------------------
// Преобразование строк БД в доменные типы
// ---------------------------------------------------------------------------

type PrismaDoc = {
  id: string;
  name: string;
  url: string;
  mime: string | null;
  size: number | null;
  docType: string | null;
  uploadedAt: Date;
};

function toDoc(d: PrismaDoc): Doc {
  return {
    id: d.id,
    name: d.name,
    url: d.url,
    mime: d.mime ?? undefined,
    size: d.size ?? undefined,
    docType: d.docType ?? undefined,
    uploadedAt: d.uploadedAt.toISOString(),
  };
}

function toPayment(p: {
  id: string;
  date: Date;
  amount: number;
  paid: boolean;
  paidAt: Date | null;
  method: string;
}): Payment {
  return {
    id: p.id,
    date: p.date,
    amount: p.amount,
    paid: p.paid,
    paidAt: p.paidAt,
    method: p.method,
  };
}

function toExpense(e: {
  id: string;
  cat: string;
  name: string;
  amount: number;
  date: Date;
  comment: string | null;
  carId: string | null;
  parkId: string | null;
}): Expense {
  return {
    id: e.id,
    cat: (e.cat in EXPENSE_CATS ? e.cat : "other") as ExpenseCat,
    name: e.name,
    amount: e.amount,
    date: e.date,
    comment: e.comment ?? "",
    carId: e.carId,
    parkId: e.parkId,
  };
}

const carInclude = {
  payments: { orderBy: { date: "asc" } },
  expenses: true,
  documents: true,
  driver: { include: { documents: true } },
} as const;

type CarRow = Awaited<ReturnType<typeof prisma.car.findMany<{ include: typeof carInclude }>>>[number];

function toCar(c: CarRow, now: Date): Car {
  // Производные предупреждения считаем из реальных данных.
  // null = поле не заполнено, значит и предупреждать не о чем.
  const insuranceDays = c.insuranceUntil
    ? Math.ceil((c.insuranceUntil.getTime() - now.getTime()) / DAY)
    : null;
  const toRemainingKm = c.nextServiceKm != null ? c.nextServiceKm - c.mileage : null;

  return {
    id: c.id,
    plate: c.plate,
    brand: c.brand,
    model: c.model,
    year: c.year,
    parkId: c.parkId,
    status: c.status === "idle" ? "idle" : "on",
    driverId: c.driverId,
    driver: c.driver?.fullName ?? "",
    phone: c.driver?.phone ?? "",
    mileage: c.mileage,
    rate: c.rate,
    mileMonth: c.mileMonth,
    managerPercent: c.managerPercent,
    payments: c.payments.map(toPayment),
    expenses: c.expenses.map(toExpense),
    docs: c.documents.filter((d) => d.kind === "vehicle").map(toDoc),
    driverDocs: (c.driver?.documents ?? []).map(toDoc),
    insuranceDays,
    toRemainingKm,
    toSoon: toRemainingKm != null && toRemainingKm <= SERVICE_SOON_KM,
  };
}

// ---------------------------------------------------------------------------
// Scope: какой парк доступен сессии
// ---------------------------------------------------------------------------

/**
 * Для админа — null (все парки). Для остальных — id их парка.
 * Если у не-админа парк не назначен, возвращается "" — заведомо
 * несуществующий id, то есть пользователь не увидит ничего.
 */
function scopeOf(session: Session): string | null {
  if (session.role === "admin") return null;
  return session.parkId ?? "";
}

function carWhere(session: Session) {
  const scope = scopeOf(session);
  return scope === null ? {} : { parkId: scope };
}

// ---------------------------------------------------------------------------
// Чтение
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<{ orgName: string; managerPercent: number }> {
  const s = await prisma.settings.findUnique({ where: { id: 1 } });
  if (s) return { orgName: s.orgName, managerPercent: s.managerPercent };
  const created = await prisma.settings.create({
    data: { id: 1, orgName: process.env.ORG_NAME || "ChizhOS" },
  });
  return { orgName: created.orgName, managerPercent: created.managerPercent };
}

export async function getManagerPercent(): Promise<number> {
  return (await getSettings()).managerPercent;
}

export async function getAllParks(): Promise<Park[]> {
  const rows = await prisma.park.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((p) => ({ id: p.id, name: p.name }));
}

/** Парки, доступные сессии: админу — все, остальным — только свой. */
export async function getScopedParks(session: Session): Promise<Park[]> {
  const scope = scopeOf(session);
  const rows = await prisma.park.findMany({
    where: scope === null ? {} : { id: scope },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((p) => ({ id: p.id, name: p.name }));
}

export async function getDismissed(): Promise<string[]> {
  const rows = await prisma.dismissedNotification.findMany();
  return rows.map((r) => r.key);
}

/** Автопарк, суженный под права сессии, со всеми расчётами. */
export async function getScopedFleet(session: Session): Promise<Fleet> {
  const scope = scopeOf(session);
  const now = today();

  const settings = await getSettings();

  const [carRows, parkRows, generalRows] = await Promise.all([
    prisma.car.findMany({
      where: carWhere(session),
      include: carInclude,
      orderBy: { plate: "asc" },
    }),
    prisma.park.findMany({
      where: scope === null ? {} : { id: scope },
      orderBy: { createdAt: "asc" },
    }),
    // Общие расходы (без привязки к авто). Пользователю парка видны только
    // расходы его парка; общефирменные (parkId = null) — только администратору.
    prisma.expense.findMany({
      where: scope === null ? { carId: null } : { carId: null, parkId: scope },
      orderBy: { date: "desc" },
    }),
  ]);

  const cars = carRows.map((c) => toCar(c, now));
  const parks: Park[] = parkRows.map((p) => ({ id: p.id, name: p.name }));
  return computeFleet(cars, parks, generalRows.map(toExpense), now, settings.managerPercent);
}

/** Водители, суженные под парк сессии. */
export async function getScopedDrivers(session: Session): Promise<Driver[]> {
  const scope = scopeOf(session);
  const rows = await prisma.driver.findMany({
    where: scope === null ? {} : { parkId: scope },
    include: { cars: { select: { plate: true } }, documents: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((d) => ({
    id: d.id,
    fullName: d.fullName,
    phone: d.phone ?? "",
    parkId: d.parkId,
    licenseNo: d.licenseNo ?? "",
    passport: d.passport ?? "",
    address: d.address ?? "",
    deposit: d.deposit,
    comment: d.comment ?? "",
    active: d.active,
    createdAt: d.createdAt.toISOString(),
    carPlates: d.cars.map((c) => c.plate),
    docs: d.documents.map(toDoc),
  }));
}

// ---------------------------------------------------------------------------
// Проверки прав
// ---------------------------------------------------------------------------

export async function canAccessCar(session: Session, carId: string): Promise<boolean> {
  if (session.role === "admin") return true;
  const car = await prisma.car.findUnique({ where: { id: carId }, select: { parkId: true } });
  return !!car && !!session.parkId && car.parkId === session.parkId;
}

export async function canAccessDriver(session: Session, driverId: string): Promise<boolean> {
  if (session.role === "admin") return true;
  const d = await prisma.driver.findUnique({ where: { id: driverId }, select: { parkId: true } });
  return !!d && !!session.parkId && d.parkId === session.parkId;
}

export async function canAccessPark(session: Session, parkId: string): Promise<boolean> {
  if (session.role === "admin") return true;
  return !!session.parkId && session.parkId === parkId;
}

// ---------------------------------------------------------------------------
// Парки
// ---------------------------------------------------------------------------

export async function addPark(name: string): Promise<void> {
  const n = name.trim();
  if (!n) throw new Error("Введите название парка");
  await prisma.park.create({ data: { name: n } });
}

export async function renamePark(id: string, name: string): Promise<void> {
  const n = name.trim();
  if (!n) throw new Error("Введите название парка");
  await prisma.park.update({ where: { id }, data: { name: n } });
}

export async function deletePark(id: string): Promise<void> {
  const [cars, users] = await Promise.all([
    prisma.car.count({ where: { parkId: id } }),
    prisma.user.count({ where: { parkId: id } }),
  ]);
  if (cars > 0) throw new Error(`В парке ещё ${cars} авто — сначала перенесите или удалите их`);
  if (users > 0) throw new Error(`К парку привязано пользователей: ${users} — сначала измените их парк`);
  await prisma.park.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Автомобили
// ---------------------------------------------------------------------------

export interface CarInput {
  plate: string;
  brand: string;
  model: string;
  year?: number | null;
  parkId: string;
  status: CarStatus;
  driverId?: string | null;
  mileage?: number;
  mileMonth?: number;
  rate?: number;
  insuranceUntil?: string | null; // ISO YYYY-MM-DD
  nextServiceKm?: number | null;
  /** null — использовать общий процент автопарка. */
  managerPercent?: number | null;
}

function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Процент управляющего к записи в БД.
 * null и пустое значение означают «использовать общий процент автопарка».
 */
function normalizePercent(v: number | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return clampPercent(n);
}

export async function addCar(input: CarInput): Promise<string> {
  const plate = input.plate.trim();
  const dup = await prisma.car.findUnique({ where: { plate } });
  if (dup) throw new Error(`Автомобиль с госномером ${plate} уже есть в системе`);

  const car = await prisma.car.create({
    data: {
      plate,
      brand: input.brand.trim(),
      model: input.model.trim(),
      year: input.year ?? null,
      parkId: input.parkId,
      status: input.status,
      driverId: input.driverId || null,
      mileage: Math.max(0, Number(input.mileage) || 0),
      mileMonth: Math.max(0, Number(input.mileMonth) || 0),
      rate: Math.max(0, Number(input.rate) || 0),
      insuranceUntil: parseDate(input.insuranceUntil),
      nextServiceKm: input.nextServiceKm ?? null,
      managerPercent: normalizePercent(input.managerPercent),
    },
  });
  return car.id;
}

export async function updateCar(id: string, input: Partial<CarInput>): Promise<void> {
  if (input.plate) {
    const plate = input.plate.trim();
    const dup = await prisma.car.findUnique({ where: { plate } });
    if (dup && dup.id !== id) throw new Error(`Госномер ${plate} уже занят другим автомобилем`);
  }
  await prisma.car.update({
    where: { id },
    data: {
      ...(input.plate !== undefined ? { plate: input.plate.trim() } : {}),
      ...(input.brand !== undefined ? { brand: input.brand.trim() } : {}),
      ...(input.model !== undefined ? { model: input.model.trim() } : {}),
      ...(input.year !== undefined ? { year: input.year } : {}),
      ...(input.parkId !== undefined ? { parkId: input.parkId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.driverId !== undefined ? { driverId: input.driverId || null } : {}),
      ...(input.mileage !== undefined ? { mileage: Math.max(0, Number(input.mileage) || 0) } : {}),
      ...(input.mileMonth !== undefined ? { mileMonth: Math.max(0, Number(input.mileMonth) || 0) } : {}),
      ...(input.rate !== undefined ? { rate: Math.max(0, Number(input.rate) || 0) } : {}),
      ...(input.insuranceUntil !== undefined
        ? { insuranceUntil: parseDate(input.insuranceUntil) }
        : {}),
      ...(input.nextServiceKm !== undefined ? { nextServiceKm: input.nextServiceKm } : {}),
      ...(input.managerPercent !== undefined
        ? { managerPercent: normalizePercent(input.managerPercent) }
        : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Процент управляющего по автомобилям
// ---------------------------------------------------------------------------

/**
 * Задать (или снять) индивидуальный процент сразу для нескольких автомобилей.
 * `percent === null` очищает индивидуальное значение — автомобили возвращаются
 * к общему проценту автопарка.
 */
export async function setCarsManagerPercent(
  carIds: string[],
  percent: number | null
): Promise<number> {
  if (!carIds.length) return 0;
  const res = await prisma.car.updateMany({
    where: { id: { in: carIds } },
    data: { managerPercent: normalizePercent(percent) },
  });
  return res.count;
}

/**
 * Применить процент ко всем автомобилям в пределах доступа сессии.
 * Администратор охватывает весь автопарк, остальные — только свой парк.
 */
export async function setAllCarsManagerPercent(
  session: Session,
  percent: number | null
): Promise<number> {
  const res = await prisma.car.updateMany({
    where: carWhere(session),
    data: { managerPercent: normalizePercent(percent) },
  });
  return res.count;
}

/** Идентификаторы автомобилей, доступных сессии (для проверок массовых операций). */
export async function accessibleCarIds(session: Session, carIds: string[]): Promise<string[]> {
  const rows = await prisma.car.findMany({
    where: { AND: [carWhere(session), { id: { in: carIds } }] },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function deleteCar(id: string): Promise<void> {
  // Платежи, расходы и документы авто удаляются каскадом (см. schema.prisma).
  await prisma.car.delete({ where: { id } });
}

export async function toggleCarStatus(carId: string): Promise<void> {
  const car = await prisma.car.findUnique({ where: { id: carId }, select: { status: true } });
  if (!car) throw new Error("Автомобиль не найден");
  await prisma.car.update({
    where: { id: carId },
    data: { status: car.status === "on" ? "idle" : "on" },
  });
}

// ---------------------------------------------------------------------------
// Платежи
// ---------------------------------------------------------------------------

export interface PaymentInput {
  carId: string;
  date: string; // ISO YYYY-MM-DD
  amount: number;
  paid: boolean;
  method: string;
  comment?: string;
}

export async function addPayment(input: PaymentInput): Promise<void> {
  const date = parseDate(input.date);
  if (!date) throw new Error("Укажите дату платежа");
  const amount = Math.round(Number(input.amount));
  if (!amount || amount <= 0) throw new Error("Укажите сумму платежа");

  const car = await prisma.car.findUnique({
    where: { id: input.carId },
    select: { driverId: true },
  });
  if (!car) throw new Error("Автомобиль не найден");

  await prisma.payment.create({
    data: {
      carId: input.carId,
      driverId: car.driverId,
      date,
      amount,
      paid: input.paid,
      paidAt: input.paid ? new Date() : null,
      method: input.method || "Карта",
      comment: input.comment?.trim() || null,
    },
  });
}

/** Закрывает ровно ОДИН день — самый ранний в текущей цепочке просрочки. */
export async function markPaidOneDay(carId: string): Promise<void> {
  const payments = await prisma.payment.findMany({
    where: { carId },
    orderBy: { date: "asc" },
  });
  const od = overdueOf(payments.map(toPayment));
  if (od === 0) return;
  const target = payments[payments.length - od];
  if (!target) return;
  await prisma.payment.update({
    where: { id: target.id },
    data: { paid: true, paidAt: new Date() },
  });
}

export async function setPaymentStatus(paymentId: string, paid: boolean): Promise<void> {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p) throw new Error("Платёж не найден");
  await prisma.payment.update({
    where: { id: paymentId },
    data: { paid, paidAt: paid ? p.paidAt ?? new Date() : null },
  });
}

export async function deletePayment(paymentId: string): Promise<void> {
  await prisma.payment.delete({ where: { id: paymentId } });
}

/** Парк платежа — для проверки прав перед изменением. */
export async function parkOfPayment(paymentId: string): Promise<string | null> {
  const p = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { car: { select: { parkId: true } } },
  });
  return p?.car.parkId ?? null;
}

// ---------------------------------------------------------------------------
// Расходы
// ---------------------------------------------------------------------------

export interface ExpenseInput {
  cat: ExpenseCat;
  amount: number;
  date: string; // ISO YYYY-MM-DD
  carId?: string | null;
  parkId?: string | null;
  name?: string;
  comment?: string;
}

export async function addExpense(input: ExpenseInput): Promise<void> {
  const date = parseDate(input.date);
  if (!date) throw new Error("Укажите дату расхода");
  const amount = Math.round(Number(input.amount));
  if (!amount || amount <= 0) throw new Error("Укажите сумму расхода");

  await prisma.expense.create({
    data: {
      cat: input.cat,
      name: input.name?.trim() || EXPENSE_CATS[input.cat],
      amount,
      date,
      carId: input.carId || null,
      parkId: input.carId ? null : input.parkId || null,
      comment: input.comment?.trim() || null,
    },
  });
}

export async function deleteExpense(id: string): Promise<void> {
  await prisma.expense.delete({ where: { id } });
}

/** Парк расхода — для проверки прав (у расхода по авто берётся парк авто). */
export async function parkOfExpense(id: string): Promise<string | null> {
  const e = await prisma.expense.findUnique({
    where: { id },
    select: { parkId: true, car: { select: { parkId: true } } },
  });
  if (!e) return null;
  return e.car?.parkId ?? e.parkId;
}

// ---------------------------------------------------------------------------
// Водители
// ---------------------------------------------------------------------------

export interface DriverInput {
  fullName: string;
  phone?: string;
  parkId?: string | null;
  licenseNo?: string;
  passport?: string;
  address?: string;
  deposit?: number;
  comment?: string;
  active?: boolean;
}

export async function addDriver(input: DriverInput): Promise<string> {
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("Укажите ФИО водителя");
  const d = await prisma.driver.create({
    data: {
      fullName,
      phone: input.phone?.trim() || null,
      parkId: input.parkId || null,
      licenseNo: input.licenseNo?.trim() || null,
      passport: input.passport?.trim() || null,
      address: input.address?.trim() || null,
      deposit: Math.max(0, Number(input.deposit) || 0),
      comment: input.comment?.trim() || null,
      active: input.active ?? true,
    },
  });
  return d.id;
}

export async function updateDriver(id: string, input: Partial<DriverInput>): Promise<void> {
  await prisma.driver.update({
    where: { id },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName.trim() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone.trim() || null } : {}),
      ...(input.parkId !== undefined ? { parkId: input.parkId || null } : {}),
      ...(input.licenseNo !== undefined ? { licenseNo: input.licenseNo.trim() || null } : {}),
      ...(input.passport !== undefined ? { passport: input.passport.trim() || null } : {}),
      ...(input.address !== undefined ? { address: input.address.trim() || null } : {}),
      ...(input.deposit !== undefined ? { deposit: Math.max(0, Number(input.deposit) || 0) } : {}),
      ...(input.comment !== undefined ? { comment: input.comment.trim() || null } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
}

export async function deleteDriver(id: string): Promise<void> {
  // Автомобили не удаляются — у них просто снимается закреплённый водитель
  // (onDelete: SetNull в схеме), поэтому история платежей сохраняется.
  await prisma.driver.delete({ where: { id } });
}

/** Закрепить водителя за автомобилем (или снять, передав null). */
export async function assignDriver(carId: string, driverId: string | null): Promise<void> {
  await prisma.car.update({ where: { id: carId }, data: { driverId: driverId || null } });
}

// ---------------------------------------------------------------------------
// Документы
// ---------------------------------------------------------------------------

/** Документы автомобиля пишутся на авто, документы водителя — на водителя. */
async function docOwner(carId: string, kind: DocKind) {
  if (kind === "vehicle") return { carId, driverId: null };
  const car = await prisma.car.findUnique({ where: { id: carId }, select: { driverId: true } });
  if (!car?.driverId) {
    throw new Error("Сначала закрепите водителя за автомобилем — документы привязываются к нему");
  }
  return { carId: null, driverId: car.driverId };
}

export async function addDoc(carId: string, kind: DocKind, meta: DocMeta): Promise<void> {
  const owner = await docOwner(carId, kind);
  await prisma.document.create({
    data: {
      kind,
      ...owner,
      name: meta.name,
      url: meta.url,
      mime: meta.mime ?? null,
      size: meta.size ?? null,
      docType: meta.docType ?? null,
    },
  });
}

export async function replaceDoc(docId: string, meta: DocMeta): Promise<void> {
  await prisma.document.update({
    where: { id: docId },
    data: {
      name: meta.name,
      url: meta.url,
      mime: meta.mime ?? null,
      size: meta.size ?? null,
      uploadedAt: new Date(),
    },
  });
}

export async function deleteDoc(docId: string): Promise<void> {
  await prisma.document.delete({ where: { id: docId } });
}

/** Парк документа — для проверки прав. */
export async function parkOfDoc(docId: string): Promise<string | null> {
  const d = await prisma.document.findUnique({
    where: { id: docId },
    select: { car: { select: { parkId: true } }, driver: { select: { parkId: true } } },
  });
  if (!d) return null;
  return d.car?.parkId ?? d.driver?.parkId ?? null;
}

// ---------------------------------------------------------------------------
// Уведомления
// ---------------------------------------------------------------------------

export async function dismissNotification(key: string): Promise<void> {
  await prisma.dismissedNotification.upsert({
    where: { key },
    update: {},
    create: { key },
  });
}

export async function clearNotifications(keys: string[]): Promise<void> {
  if (!keys.length) return;
  await prisma.dismissedNotification.createMany({
    data: keys.map((key) => ({ key })),
  });
}

// ---------------------------------------------------------------------------
// Настройки
// ---------------------------------------------------------------------------

export async function setManagerPercent(v: number): Promise<void> {
  // Дробные значения сохраняются как есть: 8.5 остаётся 8.5.
  const value = clampPercent(Number(v));
  await prisma.settings.upsert({
    where: { id: 1 },
    update: { managerPercent: value },
    create: { id: 1, managerPercent: value, orgName: process.env.ORG_NAME || "ChizhOS" },
  });
}

export async function setOrgName(name: string): Promise<void> {
  const n = name.trim();
  if (!n) throw new Error("Введите название организации");
  await prisma.settings.upsert({
    where: { id: 1 },
    update: { orgName: n },
    create: { id: 1, orgName: n },
  });
}

// ---------------------------------------------------------------------------
// Пользователи (только администратор)
// ---------------------------------------------------------------------------

function toUser(u: {
  id: string;
  login: string;
  name: string;
  role: string;
  parkId: string | null;
  blocked: boolean;
  permissions: string;
  createdAt: Date;
}): AppUser {
  return {
    id: u.id,
    login: u.login,
    name: u.name,
    role: (u.role === "admin" || u.role === "manager" ? u.role : "user") as Role,
    parkId: u.parkId,
    blocked: u.blocked,
    permissions: parsePermissions(u.permissions),
    createdAt: u.createdAt.toISOString(),
  };
}

export async function getUsers(): Promise<AppUser[]> {
  const rows = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(toUser);
}

export async function countAdmins(excludeUserId?: string): Promise<number> {
  return prisma.user.count({
    where: {
      role: "admin",
      blocked: false,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

export interface CreateUserInput {
  login: string;
  password: string;
  name: string;
  role: Role;
  parkId: string | null;
  permissions: Section[];
}

export async function createUser(input: CreateUserInput): Promise<string> {
  const login = input.login.trim();
  const dup = await prisma.user.findUnique({ where: { login } });
  if (dup) throw new Error(`Логин «${login}» уже занят`);

  const user = await prisma.user.create({
    data: {
      login,
      passwordHash: await hashPassword(input.password),
      name: input.name.trim() || login,
      role: input.role,
      // Администратор работает со всеми парками, привязка ему не нужна.
      parkId: input.role === "admin" ? null : input.parkId,
      permissions: input.role === "user" ? serializePermissions(input.permissions) : "",
    },
  });
  return user.id;
}

export interface UpdateUserInput {
  login?: string;
  name?: string;
  role?: Role;
  parkId?: string | null;
  permissions?: Section[];
  blocked?: boolean;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<void> {
  if (input.login) {
    const login = input.login.trim();
    const dup = await prisma.user.findUnique({ where: { login } });
    if (dup && dup.id !== id) throw new Error(`Логин «${login}» уже занят`);
  }

  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) throw new Error("Пользователь не найден");

  const nextRole = input.role ?? (current.role as Role);
  const nextBlocked = input.blocked ?? current.blocked;

  // Нельзя убрать/заблокировать последнего действующего администратора —
  // иначе в систему станет невозможно войти.
  const losesAdmin =
    current.role === "admin" && (nextRole !== "admin" || nextBlocked);
  if (losesAdmin && (await countAdmins(id)) === 0) {
    throw new Error("Это последний администратор — сначала назначьте другого");
  }

  await prisma.user.update({
    where: { id },
    data: {
      ...(input.login !== undefined ? { login: input.login.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.parkId !== undefined || input.role !== undefined
        ? { parkId: nextRole === "admin" ? null : input.parkId ?? current.parkId }
        : {}),
      ...(input.permissions !== undefined || input.role !== undefined
        ? {
            permissions:
              nextRole === "user"
                ? serializePermissions(input.permissions ?? parsePermissions(current.permissions))
                : "",
          }
        : {}),
      ...(input.blocked !== undefined ? { blocked: input.blocked } : {}),
    },
  });
}

export async function setUserPassword(id: string, password: string): Promise<void> {
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(password) },
  });
}

export async function deleteUser(id: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("Пользователь не найден");
  if (user.role === "admin" && (await countAdmins(id)) === 0) {
    throw new Error("Это последний администратор — его нельзя удалить");
  }
  await prisma.user.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Резервное копирование
// ---------------------------------------------------------------------------

export const BACKUP_VERSION = 2;

export async function exportData(): Promise<unknown> {
  const [settings, parks, users, drivers, cars, payments, expenses, documents, dismissed] =
    await Promise.all([
      prisma.settings.findUnique({ where: { id: 1 } }),
      prisma.park.findMany(),
      prisma.user.findMany(),
      prisma.driver.findMany(),
      prisma.car.findMany(),
      prisma.payment.findMany(),
      prisma.expense.findMany(),
      prisma.document.findMany(),
      prisma.dismissedNotification.findMany(),
    ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    parks,
    // Хеши паролей включены: без них восстановленные пользователи не смогли бы войти.
    users,
    drivers,
    cars,
    payments,
    expenses,
    documents,
    dismissed,
  };
}

type AnyRecord = Record<string, unknown>;

const asArray = (v: unknown): AnyRecord[] => (Array.isArray(v) ? (v as AnyRecord[]) : []);
const asDate = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Восстановление из резервной копии — ПОЛНОЙ заменой содержимого базы.
 * Выполняется одной транзакцией: при ошибке база остаётся нетронутой.
 */
export async function importData(data: unknown): Promise<void> {
  if (!data || typeof data !== "object") throw new Error("Некорректный файл резервной копии");
  const d = data as AnyRecord;
  if (!Array.isArray(d.parks) || !Array.isArray(d.cars)) {
    throw new Error("Файл не похож на резервную копию ChizhOS");
  }

  await prisma.$transaction(async (tx) => {
    // Порядок важен: сначала зависимые таблицы, потом справочники.
    await tx.authSession.deleteMany();
    await tx.document.deleteMany();
    await tx.payment.deleteMany();
    await tx.expense.deleteMany();
    await tx.car.deleteMany();
    await tx.driver.deleteMany();
    await tx.user.deleteMany();
    await tx.park.deleteMany();
    await tx.dismissedNotification.deleteMany();

    for (const p of asArray(d.parks)) {
      await tx.park.create({
        data: {
          id: String(p.id),
          name: String(p.name ?? "Парк"),
          createdAt: asDate(p.createdAt) ?? new Date(),
        },
      });
    }

    for (const u of asArray(d.users)) {
      if (!u.login || !u.passwordHash) continue;
      await tx.user.create({
        data: {
          id: String(u.id),
          login: String(u.login),
          passwordHash: String(u.passwordHash),
          name: String(u.name ?? u.login),
          role: String(u.role ?? "user"),
          parkId: u.parkId ? String(u.parkId) : null,
          blocked: Boolean(u.blocked),
          permissions: String(u.permissions ?? ""),
          createdAt: asDate(u.createdAt) ?? new Date(),
        },
      });
    }

    for (const dr of asArray(d.drivers)) {
      await tx.driver.create({
        data: {
          id: String(dr.id),
          fullName: String(dr.fullName ?? "—"),
          phone: dr.phone ? String(dr.phone) : null,
          parkId: dr.parkId ? String(dr.parkId) : null,
          licenseNo: dr.licenseNo ? String(dr.licenseNo) : null,
          passport: dr.passport ? String(dr.passport) : null,
          address: dr.address ? String(dr.address) : null,
          deposit: Number(dr.deposit) || 0,
          comment: dr.comment ? String(dr.comment) : null,
          active: dr.active === undefined ? true : Boolean(dr.active),
          createdAt: asDate(dr.createdAt) ?? new Date(),
        },
      });
    }

    for (const c of asArray(d.cars)) {
      await tx.car.create({
        data: {
          id: String(c.id),
          plate: String(c.plate ?? c.id),
          brand: String(c.brand ?? ""),
          model: String(c.model ?? ""),
          year: c.year == null ? null : Number(c.year),
          parkId: String(c.parkId),
          status: c.status === "idle" ? "idle" : "on",
          driverId: c.driverId ? String(c.driverId) : null,
          mileage: Number(c.mileage) || 0,
          mileMonth: Number(c.mileMonth) || 0,
          rate: Number(c.rate) || 0,
          insuranceUntil: asDate(c.insuranceUntil),
          nextServiceKm: c.nextServiceKm == null ? null : Number(c.nextServiceKm),
          // Копии, снятые до появления индивидуальных процентов, поля не содержат —
          // такие автомобили наследуют общий процент автопарка.
          managerPercent: normalizePercent(
            c.managerPercent == null ? null : Number(c.managerPercent)
          ),
          createdAt: asDate(c.createdAt) ?? new Date(),
        },
      });
    }

    for (const p of asArray(d.payments)) {
      const date = asDate(p.date);
      if (!date) continue;
      await tx.payment.create({
        data: {
          id: String(p.id),
          carId: String(p.carId),
          driverId: p.driverId ? String(p.driverId) : null,
          date,
          amount: Number(p.amount) || 0,
          paid: Boolean(p.paid),
          paidAt: asDate(p.paidAt),
          method: String(p.method ?? "Карта"),
          comment: p.comment ? String(p.comment) : null,
        },
      });
    }

    for (const e of asArray(d.expenses)) {
      const date = asDate(e.date);
      if (!date) continue;
      await tx.expense.create({
        data: {
          id: String(e.id),
          carId: e.carId ? String(e.carId) : null,
          parkId: e.parkId ? String(e.parkId) : null,
          cat: String(e.cat ?? "other"),
          name: String(e.name ?? "Расход"),
          amount: Number(e.amount) || 0,
          date,
          comment: e.comment ? String(e.comment) : null,
        },
      });
    }

    for (const doc of asArray(d.documents)) {
      await tx.document.create({
        data: {
          id: String(doc.id),
          kind: doc.kind === "driver" ? "driver" : "vehicle",
          carId: doc.carId ? String(doc.carId) : null,
          driverId: doc.driverId ? String(doc.driverId) : null,
          docType: doc.docType ? String(doc.docType) : null,
          name: String(doc.name ?? "Документ"),
          url: String(doc.url ?? ""),
          mime: doc.mime ? String(doc.mime) : null,
          size: doc.size == null ? null : Number(doc.size),
          uploadedAt: asDate(doc.uploadedAt) ?? new Date(),
        },
      });
    }

    for (const n of asArray(d.dismissed)) {
      if (!n.key) continue;
      await tx.dismissedNotification.create({ data: { key: String(n.key) } });
    }

    const s = d.settings as AnyRecord | undefined;
    await tx.settings.upsert({
      where: { id: 1 },
      update: {
        orgName: String(s?.orgName ?? "ChizhOS"),
        managerPercent: Number(s?.managerPercent) || 0,
      },
      create: {
        id: 1,
        orgName: String(s?.orgName ?? "ChizhOS"),
        managerPercent: Number(s?.managerPercent) || 0,
      },
    });
  });
}
