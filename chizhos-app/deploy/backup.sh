#!/bin/bash
#
# Резервное копирование ChizhOS.
#
# Копируются ОБЕ части данных:
#   1. База данных  — автопарки, автомобили, водители, платежи, расходы, пользователи.
#   2. Папка uploads — сами файлы документов (сканы, фотографии, PDF).
# Одной базы недостаточно: без папки uploads документы не восстановятся.
#
# Ручной запуск:
#   sudo /usr/local/bin/chizhos-backup
#
# По расписанию (ежедневно в 3:30) — см. DEPLOY-TIMEWEB.md, раздел 14.
#
set -e

APP_DIR="/var/www/chizhos"
DEST="$APP_DIR/backups"
DATE=$(date +%F)
KEEP_DAYS=30

mkdir -p "$DEST"

# .backup — штатная команда SQLite: снимает копию корректно
# даже когда приложение в этот момент работает с базой.
sqlite3 "$APP_DIR/data/chizhos.db" ".backup '$DEST/chizhos-$DATE.db'"

# Документы.
tar -czf "$DEST/uploads-$DATE.tar.gz" -C "$APP_DIR/public" uploads 2>/dev/null || true

# Удаляем копии старше 30 дней, чтобы не заполнить диск.
find "$DEST" -name 'chizhos-*.db' -mtime +$KEEP_DAYS -delete
find "$DEST" -name 'uploads-*.tar.gz' -mtime +$KEEP_DAYS -delete

echo "$(date '+%F %T') Копия создана: $DEST/chizhos-$DATE.db"
