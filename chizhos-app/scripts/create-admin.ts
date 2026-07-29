/**
 * Создание первого администратора и первичная настройка системы.
 *
 *   npm run create-admin
 *
 * Логин и пароль берутся из .env (ADMIN_LOGIN / ADMIN_PASSWORD / ADMIN_NAME)
 * либо из аргументов:
 *
 *   npm run create-admin -- --login=admin --password=СекретныйПароль --name="Иван"
 *
 * Скрипт безопасно запускать повторно:
 *  - если администратор с таким логином уже есть, ему обновляется пароль
 *    (это же способ восстановить доступ, если пароль забыт);
 *  - существующие данные не удаляются.
 *
 * ВАЖНО: демонстрационные данные не создаются. После установки система пустая.
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword, validateLogin, validatePassword } from "../src/lib/auth";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found?.slice(prefix.length);
}

async function main() {
  const login = (arg("login") || process.env.ADMIN_LOGIN || "admin").trim();
  const password = arg("password") || process.env.ADMIN_PASSWORD || "";
  const name = arg("name") || process.env.ADMIN_NAME || "Администратор";

  const loginError = validateLogin(login);
  if (loginError) {
    console.error(`\n✖ Логин «${login}»: ${loginError}\n`);
    process.exit(1);
  }

  if (!password) {
    console.error(
      "\n✖ Не задан пароль администратора.\n" +
        "  Укажите ADMIN_PASSWORD в файле .env либо запустите:\n" +
        '  npm run create-admin -- --login=admin --password="ВашПароль"\n'
    );
    process.exit(1);
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    console.error(`\n✖ ${passwordError}\n`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { login } });

  if (existing) {
    await prisma.user.update({
      where: { login },
      data: { passwordHash, role: "admin", blocked: false, parkId: null, permissions: "" },
    });
    // Старые сессии после смены пароля недействительны.
    await prisma.authSession.deleteMany({ where: { userId: existing.id } });
    console.log(`\n✔ Пароль администратора «${login}» обновлён, доступ восстановлен.`);
  } else {
    await prisma.user.create({
      data: { login, passwordHash, name, role: "admin", permissions: "" },
    });
    console.log(`\n✔ Создан администратор «${login}».`);
  }

  // Единственная строка настроек — создаём, если её ещё нет.
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, orgName: process.env.ORG_NAME || "ChizhOS" },
  });

  const [users, parks, cars, drivers] = await Promise.all([
    prisma.user.count(),
    prisma.park.count(),
    prisma.car.count(),
    prisma.driver.count(),
  ]);

  console.log("\nСостояние базы данных:");
  console.log(`  пользователей: ${users}`);
  console.log(`  автопарков:    ${parks}`);
  console.log(`  автомобилей:   ${cars}`);
  console.log(`  водителей:     ${drivers}`);
  console.log(
    "\nДальше: откройте сайт, войдите под этим логином и создайте автопарк\n" +
      "в разделе «Администрирование → Автопарки».\n"
  );

  if (password.length < 10) {
    console.log(
      "⚠ Пароль короткий. Смените его после первого входа:\n" +
        "  Администрирование → Настройки → Мой пароль.\n"
    );
  }
}

main()
  .catch((e) => {
    console.error("\n✖ Ошибка:", e instanceof Error ? e.message : e, "\n");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
