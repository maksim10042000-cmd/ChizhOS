/**
 * Конфигурация PM2 — менеджера процессов, который держит ChizhOS запущенным.
 *
 * PM2 сам перезапустит приложение, если оно упадёт, и поднимет его
 * после перезагрузки сервера.
 *
 * Запуск:      pm2 start ecosystem.config.js
 * Перезапуск:  pm2 restart chizhos
 * Логи:        pm2 logs chizhos
 *
 * Файл рассчитан на установку в /var/www/chizhos (см. DEPLOY-TIMEWEB.md).
 * Если проект лежит в другой папке — измените значение cwd ниже.
 */
module.exports = {
  apps: [
    {
      // Имя, под которым приложение видно в `pm2 list`.
      name: "chizhos",

      // Папка проекта на сервере.
      cwd: "/var/www/chizhos",

      // Запускаем сервер Next.js напрямую, без обёртки npm:
      // так PM2 корректно перезапускает и останавливает процесс.
      script: "./node_modules/next/dist/bin/next",
      args: "start",

      // Одного процесса достаточно: база — SQLite, файл открывает один процесс.
      // Несколько экземпляров привели бы к конфликтам записи в базу.
      instances: 1,
      exec_mode: "fork",

      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },

      // Если приложение упадёт — поднять снова.
      autorestart: true,
      // Защита от бесконечного цикла падений.
      min_uptime: "20s",
      max_restarts: 10,
      // Перезапуск при утечке памяти.
      max_memory_restart: "512M",

      // Логи. Папку logs создаёт скрипт установки.
      error_file: "/var/www/chizhos/logs/error.log",
      out_file: "/var/www/chizhos/logs/out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
