#!/bin/bash
#
# Безопасное обновление ChizhOS на сервере.
#
# Что делает по шагам:
#   1. Делает резервную копию базы и документов — на случай, если что-то пойдёт не так.
#   2. Забирает новую версию кода.
#   3. Доустанавливает библиотеки.
#   4. Применяет миграции базы данных (данные при этом сохраняются).
#   5. Пересобирает проект.
#   6. Перезапускает приложение.
#
# Запуск на сервере:
#   sudo -u chizhos bash /var/www/chizhos/deploy/update.sh
#
# set -e останавливает скрипт при первой же ошибке,
# чтобы не продолжать обновление на сломанном шаге.
set -e

APP_DIR="/var/www/chizhos"
cd "$APP_DIR"

echo "==> 1/6 Резервная копия"
mkdir -p backups
STAMP=$(date +%F-%H%M)
if [ -f data/chizhos.db ]; then
  sqlite3 data/chizhos.db ".backup 'backups/before-update-$STAMP.db'"
  echo "    база сохранена: backups/before-update-$STAMP.db"
fi
if [ -d public/uploads ]; then
  tar -czf "backups/uploads-$STAMP.tar.gz" -C public uploads 2>/dev/null || true
  echo "    документы сохранены: backups/uploads-$STAMP.tar.gz"
fi

echo "==> 2/6 Получение новой версии"
if [ -d .git ]; then
  git pull
else
  echo "    репозиторий Git не найден — загрузите новые файлы вручную и запустите скрипт снова"
fi

echo "==> 3/6 Установка библиотек"
npm ci

echo "==> 4/6 Миграции базы данных"
npx prisma migrate deploy
npx prisma generate

echo "==> 5/6 Сборка проекта"
npm run build

echo "==> 6/6 Перезапуск приложения"
pm2 restart chizhos

echo ""
echo "Готово. Проверьте сайт в браузере."
echo "Если что-то сломалось, восстановите базу командой:"
echo "  pm2 stop chizhos && cp backups/before-update-$STAMP.db data/chizhos.db && pm2 start chizhos"
