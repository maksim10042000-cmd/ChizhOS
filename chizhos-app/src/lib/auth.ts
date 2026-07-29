import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

/**
 * Хеширование паролей на scrypt из стандартной библиотеки Node.
 * Намеренно без bcrypt/argon2: те требуют компиляции нативного модуля,
 * что ломает установку на «чистом» сервере без build-tools.
 *
 * Формат хранения: scrypt$<соль hex>$<хеш hex>.
 * Соль своя у каждого пароля, сравнение — постоянного времени.
 */

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, KEY_LEN);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, salt, hash] = (stored || "").split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  let expected: Buffer;
  try {
    expected = Buffer.from(hash, "hex");
  } catch {
    return false;
  }
  if (expected.length !== KEY_LEN) return false;
  const derived = await scrypt(password, salt, KEY_LEN);
  return timingSafeEqual(derived, expected);
}

/** Случайный токен сессии (256 бит). */
export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export const SESSION_COOKIE = "chizhos_session";
export const SESSION_TTL_DAYS = 30;

/** Требования к паролю. Возвращает текст ошибки либо null. */
export function validatePassword(password: string): string | null {
  if (!password || password.length < 6) return "Пароль должен быть не короче 6 символов";
  if (password.length > 200) return "Пароль слишком длинный";
  return null;
}

/** Требования к логину. Возвращает текст ошибки либо null. */
export function validateLogin(login: string): string | null {
  const v = (login || "").trim();
  if (v.length < 3) return "Логин должен быть не короче 3 символов";
  if (v.length > 60) return "Логин слишком длинный";
  if (!/^[a-zA-Z0-9._@-]+$/.test(v)) {
    return "Логин может содержать латинские буквы, цифры и символы . _ - @";
  }
  return null;
}
