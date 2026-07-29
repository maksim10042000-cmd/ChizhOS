import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, SESSION_TTL_DAYS, newSessionToken, verifyPassword } from "@/lib/auth";
import { ALL_SECTIONS, type Role, type Section, type Session } from "@/lib/types";

export { SESSION_COOKIE };

/** "cars,finance" → ["cars","finance"]; мусорные значения отбрасываются. */
export function parsePermissions(raw: string | null | undefined): Section[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Section => (ALL_SECTIONS as string[]).includes(s));
}

export function serializePermissions(list: Section[]): string {
  return Array.from(new Set(list)).join(",");
}

function normalizeRole(raw: string): Role {
  return raw === "admin" || raw === "manager" ? raw : "user";
}

/**
 * Текущая сессия из cookie.
 * Обёрнута в cache(): за один HTTP-запрос страницы, layout и server actions
 * зовут её многократно, а запрос к БД выполняется один раз.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await prisma.authSession.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  // Заблокированный пользователь теряет доступ немедленно, не дожидаясь выхода.
  if (row.user.blocked) return null;

  const role = normalizeRole(row.user.role);
  return {
    userId: row.user.id,
    login: row.user.login,
    name: row.user.name,
    role,
    // Администратор видит все парки, поэтому его сессия не привязана к парку.
    parkId: role === "admin" ? null : row.user.parkId,
    permissions: parsePermissions(row.user.permissions),
  };
});

export interface LoginResult {
  ok: boolean;
  error?: string;
}

/**
 * Проверка логина/пароля и выдача сессии.
 * Сообщение об ошибке намеренно одинаковое для «нет такого логина»
 * и «неверный пароль» — чтобы нельзя было перебором узнать существующие логины.
 */
export async function login(loginRaw: string, password: string): Promise<LoginResult> {
  const userLogin = (loginRaw || "").trim();
  if (!userLogin || !password) return { ok: false, error: "Введите логин и пароль" };

  const user = await prisma.user.findUnique({ where: { login: userLogin } });
  if (!user) return { ok: false, error: "Неверный логин или пароль" };

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { ok: false, error: "Неверный логин или пароль" };

  if (user.blocked) {
    return { ok: false, error: "Учётная запись заблокирована. Обратитесь к администратору." };
  }

  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await prisma.authSession.create({ data: { token, userId: user.id, expiresAt } });

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 86_400,
  });

  // Попутная уборка протухших сессий — отдельный крон для этого не нужен.
  await prisma.authSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  return { ok: true };
}

/** Выход: удаляем сессию из БД и стираем cookie. */
export async function logout(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.authSession.deleteMany({ where: { token } });
  }
  cookies().set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

/** Завершить все сессии пользователя (при блокировке или смене пароля). */
export async function revokeUserSessions(userId: string): Promise<void> {
  await prisma.authSession.deleteMany({ where: { userId } });
}
