"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, login as doLogin, logout as doLogout, revokeUserSessions } from "@/lib/session";
import { validateLogin, validatePassword } from "@/lib/auth";
import * as repo from "@/lib/data/repo";
import type {
  CarStatus,
  DocKind,
  DocMeta,
  ExpenseCat,
  Role,
  Section,
  Session,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Проверки прав
// ---------------------------------------------------------------------------

async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Error("Сессия истекла — войдите заново");
  return s;
}

async function requireAdmin(): Promise<Session> {
  const s = await requireSession();
  if (s.role !== "admin") throw new Error("Требуются права администратора");
  return s;
}

async function assertCarAccess(session: Session, carId: string) {
  if (!(await repo.canAccessCar(session, carId))) {
    throw new Error("Нет прав на этот автомобиль");
  }
}

async function assertDriverAccess(session: Session, driverId: string) {
  if (!(await repo.canAccessDriver(session, driverId))) {
    throw new Error("Нет прав на этого водителя");
  }
}

/**
 * Право менять проценты управляющего.
 * Администратор — везде, менеджер парка — в своём парке (проверяется отдельно
 * доступом к автомобилю), обычный пользователь — только смотрит результаты.
 */
async function requirePercentEditor(): Promise<Session> {
  const s = await requireSession();
  if (s.role !== "admin" && s.role !== "manager") {
    throw new Error("Изменение процента управляющего доступно администратору и менеджеру парка");
  }
  return s;
}

/** Проверка процента, приходящего из формы. null = вернуть общий процент. */
function validatePercent(percent: number | null): number | null {
  if (percent === null) return null;
  const n = Number(percent);
  if (!Number.isFinite(n)) throw new Error("Процент должен быть числом");
  if (n < 0 || n > 100) throw new Error("Процент должен быть в диапазоне от 0 до 100");
  return n;
}

/** Парк, в который не-админ вправе писать: всегда его собственный. */
function resolveParkId(session: Session, requested?: string | null): string {
  if (session.role === "admin") {
    const id = (requested ?? "").trim();
    if (!id) throw new Error("Выберите парк");
    return id;
  }
  if (!session.parkId) throw new Error("Вам не назначен автопарк — обратитесь к администратору");
  return session.parkId;
}

/** Пересчитать всю защищённую зону: счётчики в меню и все страницы. */
function refresh() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Вход и выход
// ---------------------------------------------------------------------------

export async function loginAction(login: string, password: string): Promise<{ error?: string }> {
  const res = await doLogin(login, password);
  if (!res.ok) return { error: res.error };
  refresh();
  return {};
}

export async function logoutAction() {
  await doLogout();
  refresh();
  redirect("/");
}

/** Смена собственного пароля (доступна любому вошедшему пользователю). */
export async function changeOwnPasswordAction(currentPassword: string, newPassword: string) {
  const s = await requireSession();
  const err = validatePassword(newPassword);
  if (err) throw new Error(err);

  const check = await doLogin(s.login, currentPassword);
  if (!check.ok) throw new Error("Текущий пароль указан неверно");

  await repo.setUserPassword(s.userId, newPassword);
  refresh();
}

// ---------------------------------------------------------------------------
// Платежи
// ---------------------------------------------------------------------------

export async function markPaidAction(carId: string) {
  const s = await requireSession();
  await assertCarAccess(s, carId);
  await repo.markPaidOneDay(carId);
  refresh();
}

export async function setPaymentStatusAction(paymentId: string, paid: boolean) {
  const s = await requireSession();
  const parkId = await repo.parkOfPayment(paymentId);
  if (!parkId || !(await repo.canAccessPark(s, parkId))) throw new Error("Нет прав на этот платёж");
  await repo.setPaymentStatus(paymentId, paid);
  refresh();
}

export async function addPaymentAction(input: {
  carId: string;
  date: string;
  amount: number;
  paid: boolean;
  method: string;
  comment?: string;
}) {
  const s = await requireSession();
  await assertCarAccess(s, input.carId);
  await repo.addPayment(input);
  refresh();
}

export async function deletePaymentAction(paymentId: string) {
  const s = await requireSession();
  const parkId = await repo.parkOfPayment(paymentId);
  if (!parkId || !(await repo.canAccessPark(s, parkId))) throw new Error("Нет прав на этот платёж");
  await repo.deletePayment(paymentId);
  refresh();
}

// ---------------------------------------------------------------------------
// Автомобили
// ---------------------------------------------------------------------------

export async function toggleStatusAction(carId: string) {
  const s = await requireSession();
  await assertCarAccess(s, carId);
  await repo.toggleCarStatus(carId);
  refresh();
}

export interface CarFormInput {
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
  insuranceUntil?: string | null;
  nextServiceKm?: number | null;
  managerPercent?: number | null;
}

export async function addCarAction(input: CarFormInput) {
  const s = await requireSession();
  const parkId = resolveParkId(s, input.parkId);
  if (!input.plate?.trim() || !input.brand?.trim() || !input.model?.trim()) {
    throw new Error("Заполните госномер, марку и модель");
  }
  if (input.driverId) await assertDriverAccess(s, input.driverId);
  await repo.addCar({ ...input, parkId });
  refresh();
}

export async function updateCarAction(carId: string, input: Partial<CarFormInput>) {
  const s = await requireSession();
  await assertCarAccess(s, carId);
  const parkId = input.parkId !== undefined ? resolveParkId(s, input.parkId) : undefined;
  if (input.driverId) await assertDriverAccess(s, input.driverId);
  await repo.updateCar(carId, { ...input, ...(parkId ? { parkId } : {}) });
  refresh();
}

export async function deleteCarAction(carId: string) {
  const s = await requireSession();
  await assertCarAccess(s, carId);
  await repo.deleteCar(carId);
  refresh();
}

export async function assignDriverAction(carId: string, driverId: string | null) {
  const s = await requireSession();
  await assertCarAccess(s, carId);
  if (driverId) await assertDriverAccess(s, driverId);
  await repo.assignDriver(carId, driverId);
  refresh();
}

// ---------------------------------------------------------------------------
// Расходы
// ---------------------------------------------------------------------------

export async function addExpenseAction(input: {
  cat: ExpenseCat;
  amount: number;
  date: string;
  carId?: string | null;
  parkId?: string | null;
  name?: string;
  comment?: string;
}) {
  const s = await requireSession();
  if (input.carId) {
    await assertCarAccess(s, input.carId);
    await repo.addExpense(input);
  } else {
    // Общий расход без авто: не-админ относит его на свой парк,
    // администратор может оставить общефирменным.
    const parkId = s.role === "admin" ? input.parkId ?? null : s.parkId ?? null;
    if (s.role !== "admin" && !parkId) {
      throw new Error("Вам не назначен автопарк — обратитесь к администратору");
    }
    await repo.addExpense({ ...input, carId: null, parkId });
  }
  refresh();
}

export async function deleteExpenseAction(id: string) {
  const s = await requireSession();
  const parkId = await repo.parkOfExpense(id);
  // Общефирменный расход (без парка) удаляет только администратор.
  if (parkId === null) {
    await requireAdmin();
  } else if (!(await repo.canAccessPark(s, parkId))) {
    throw new Error("Нет прав на этот расход");
  }
  await repo.deleteExpense(id);
  refresh();
}

// ---------------------------------------------------------------------------
// Водители
// ---------------------------------------------------------------------------

export interface DriverFormInput {
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

export async function addDriverAction(input: DriverFormInput) {
  const s = await requireSession();
  if (!input.fullName?.trim()) throw new Error("Укажите ФИО водителя");
  const parkId = resolveParkId(s, input.parkId);
  await repo.addDriver({ ...input, parkId });
  refresh();
}

export async function updateDriverAction(id: string, input: Partial<DriverFormInput>) {
  const s = await requireSession();
  await assertDriverAccess(s, id);
  const parkId = input.parkId !== undefined ? resolveParkId(s, input.parkId) : undefined;
  await repo.updateDriver(id, { ...input, ...(parkId ? { parkId } : {}) });
  refresh();
}

export async function deleteDriverAction(id: string) {
  const s = await requireSession();
  await assertDriverAccess(s, id);
  await repo.deleteDriver(id);
  refresh();
}

// ---------------------------------------------------------------------------
// Парки (только администратор)
// ---------------------------------------------------------------------------

export async function addParkAction(name: string) {
  await requireAdmin();
  await repo.addPark(name);
  refresh();
}

export async function renameParkAction(id: string, name: string) {
  await requireAdmin();
  await repo.renamePark(id, name);
  refresh();
}

export async function deleteParkAction(id: string) {
  await requireAdmin();
  await repo.deletePark(id);
  refresh();
}

// ---------------------------------------------------------------------------
// Документы
// ---------------------------------------------------------------------------

export async function addDocAction(carId: string, kind: DocKind, meta: DocMeta) {
  const s = await requireSession();
  await assertCarAccess(s, carId);
  if (!meta?.url || !meta?.name) throw new Error("Файл не загружен");
  await repo.addDoc(carId, kind, meta);
  refresh();
}

export async function replaceDocAction(docId: string, meta: DocMeta) {
  const s = await requireSession();
  const parkId = await repo.parkOfDoc(docId);
  if (!parkId || !(await repo.canAccessPark(s, parkId))) throw new Error("Нет прав на этот документ");
  await repo.replaceDoc(docId, meta);
  refresh();
}

export async function deleteDocAction(docId: string) {
  const s = await requireSession();
  const parkId = await repo.parkOfDoc(docId);
  if (!parkId || !(await repo.canAccessPark(s, parkId))) throw new Error("Нет прав на этот документ");
  await repo.deleteDoc(docId);
  refresh();
}

// ---------------------------------------------------------------------------
// Настройки (только администратор)
// ---------------------------------------------------------------------------

/**
 * Общий процент управляющего по автопарку.
 * Меняет только администратор — это настройка уровня всей организации.
 */
export async function setManagerPercentAction(value: number) {
  await requireAdmin();
  const percent = validatePercent(value);
  if (percent === null) throw new Error("Укажите процент");
  await repo.setManagerPercent(percent);
  refresh();
}

// ---------------------------------------------------------------------------
// Процент управляющего по автомобилям
// ---------------------------------------------------------------------------

/** Индивидуальный процент одного автомобиля. null — вернуть общий процент. */
export async function setCarManagerPercentAction(carId: string, percent: number | null) {
  const s = await requirePercentEditor();
  await assertCarAccess(s, carId);
  await repo.updateCar(carId, { managerPercent: validatePercent(percent) });
  refresh();
}

/**
 * Массовое изменение процента у выбранных автомобилей.
 * Автомобили вне зоны доступа отсеиваются на сервере, а не в интерфейсе.
 */
export async function setCarsManagerPercentAction(
  carIds: string[],
  percent: number | null
): Promise<{ updated: number }> {
  const s = await requirePercentEditor();
  if (!carIds.length) throw new Error("Выберите хотя бы один автомобиль");

  const allowed = await repo.accessibleCarIds(s, carIds);
  if (allowed.length === 0) throw new Error("Нет прав на выбранные автомобили");

  const updated = await repo.setCarsManagerPercent(allowed, validatePercent(percent));
  refresh();
  return { updated };
}

/**
 * Применить процент ко всем автомобилям: администратору — по всему автопарку,
 * менеджеру парка — только по своему парку.
 */
export async function applyManagerPercentToAllAction(
  percent: number | null
): Promise<{ updated: number }> {
  const s = await requirePercentEditor();
  const updated = await repo.setAllCarsManagerPercent(s, validatePercent(percent));
  refresh();
  return { updated };
}

export async function setOrgNameAction(name: string) {
  await requireAdmin();
  await repo.setOrgName(name);
  refresh();
}

// ---------------------------------------------------------------------------
// Пользователи (только администратор)
// ---------------------------------------------------------------------------

export async function createUserAction(input: {
  login: string;
  password: string;
  name: string;
  role: Role;
  parkId: string | null;
  permissions: Section[];
}) {
  await requireAdmin();

  const loginErr = validateLogin(input.login);
  if (loginErr) throw new Error(loginErr);
  const passErr = validatePassword(input.password);
  if (passErr) throw new Error(passErr);
  if (input.role !== "admin" && !input.parkId) {
    throw new Error("Выберите автопарк — он обязателен для всех, кроме администратора");
  }

  await repo.createUser(input);
  refresh();
}

export async function updateUserAction(
  id: string,
  input: {
    login?: string;
    name?: string;
    role?: Role;
    parkId?: string | null;
    permissions?: Section[];
    blocked?: boolean;
  }
) {
  await requireAdmin();
  if (input.login) {
    const err = validateLogin(input.login);
    if (err) throw new Error(err);
  }
  if (input.role && input.role !== "admin" && input.parkId === null) {
    throw new Error("Выберите автопарк — он обязателен для всех, кроме администратора");
  }

  await repo.updateUser(id, input);
  // Блокировка должна действовать сразу, поэтому обрываем активные сессии.
  if (input.blocked) await revokeUserSessions(id);
  refresh();
}

export async function setUserPasswordAction(id: string, password: string) {
  await requireAdmin();
  const err = validatePassword(password);
  if (err) throw new Error(err);
  await repo.setUserPassword(id, password);
  // После смены пароля старые сессии пользователя перестают действовать.
  await revokeUserSessions(id);
  refresh();
}

export async function deleteUserAction(id: string) {
  const admin = await requireAdmin();
  if (admin.userId === id) throw new Error("Нельзя удалить собственную учётную запись");
  await repo.deleteUser(id);
  refresh();
}

// ---------------------------------------------------------------------------
// Уведомления
// ---------------------------------------------------------------------------

export async function dismissNotifAction(id: string) {
  await requireSession();
  await repo.dismissNotification(id);
  refresh();
}

export async function clearNotifsAction(ids: string[]) {
  await requireSession();
  await repo.clearNotifications(ids);
  refresh();
}

// ---------------------------------------------------------------------------
// Резервное копирование (только администратор)
// ---------------------------------------------------------------------------

export async function importDataAction(json: string) {
  await requireAdmin();
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Файл не является корректным JSON");
  }
  await repo.importData(parsed);
  refresh();
}
