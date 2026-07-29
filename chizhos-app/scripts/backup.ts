/**
 * Резервная копия из командной строки — для запуска по расписанию (cron).
 *
 *   npm run backup                  → backups/chizhos-backup-ГГГГ-ММ-ДД.json
 *   npm run backup -- --out=/path/file.json
 *
 * Копируются все данные: автопарки, автомобили, водители, платежи, расходы,
 * документы (записи), пользователи и настройки.
 * Сами файлы документов лежат в public/uploads — их нужно копировать отдельно
 * (пример команды есть в INSTALL.md).
 */

import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found?.slice(prefix.length);
}

async function main() {
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

  const data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings, parks, users, drivers, cars, payments, expenses, documents, dismissed,
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const out = arg("out") || path.join(process.cwd(), "backups", `chizhos-backup-${stamp}.json`);

  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(data, null, 2), "utf8");

  console.log(`✔ Резервная копия сохранена: ${out}`);
  console.log(
    `  автопарков: ${parks.length}, авто: ${cars.length}, водителей: ${drivers.length}, ` +
      `платежей: ${payments.length}, расходов: ${expenses.length}, пользователей: ${users.length}`
  );
}

main()
  .catch((e) => {
    console.error("✖ Ошибка резервного копирования:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
