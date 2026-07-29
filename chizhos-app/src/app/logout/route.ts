import { NextResponse } from "next/server";
import { logout } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Выход из системы: удаляет сессию из базы и стирает cookie,
 * после чего возвращает на страницу входа.
 *
 * Кнопка «Выйти» в интерфейсе вызывает server action, а этот маршрут нужен
 * для прямого перехода по адресу /logout (как описано в структуре проекта).
 */
async function end(req: Request) {
  await logout();
  return NextResponse.redirect(new URL("/", req.url));
}

export const GET = end;
export const POST = end;
