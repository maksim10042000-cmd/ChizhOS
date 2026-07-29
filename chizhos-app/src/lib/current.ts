import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getScopedFleet, getSettings } from "@/lib/data/repo";
import { SECTIONS, sectionsFor, type Section, type Session } from "@/lib/types";
import type { Fleet } from "@/lib/domain/finance";

/** Сессия или редирект на страницу входа. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/");
  return session;
}

/** Только для администратора. */
export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/dashboard");
  return session;
}

/** Первый раздел, доступный пользователю — куда его вести по умолчанию. */
export function firstAllowedHref(session: Session): string {
  const allowed = sectionsFor(session.role, session.permissions);
  const s = SECTIONS.find((x) => allowed.includes(x.key));
  return s?.href ?? "/dashboard";
}

/**
 * Проверка доступа к разделу. Если раздел не разрешён — пользователя уводит
 * на первый доступный ему раздел, а не на страницу с ошибкой.
 */
export async function requireSection(section: Section): Promise<Session> {
  const session = await requireSession();
  const allowed = sectionsFor(session.role, session.permissions);
  if (!allowed.includes(section)) redirect(firstAllowedHref(session));
  return session;
}

export interface PageContext {
  session: Session;
  fleet: Fleet;
  settings: { orgName: string; managerPercent: number };
}

/** Сессия + автопарк, суженный под её права + общие настройки. */
export async function currentContext(section: Section): Promise<PageContext> {
  const session = await requireSection(section);
  const [fleet, settings] = await Promise.all([getScopedFleet(session), getSettings()]);
  return { session, fleet, settings };
}
