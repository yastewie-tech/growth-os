#!/bin/bash
set -e

echo "🚀 Инициализация базы данных..."
npx tsx server/seed-force.ts

echo "✅ База готова!"
echo ""
echo "🌐 Запуск сервера на порту 5000..."
npm run serve
