#!/usr/bin/env bash
# setup.sh — Start TenderIQ

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "=== TenderIQ Setup ==="
echo ""

# Load env
source "$SCRIPT_DIR/backend/.env"

# 1. Install deps if needed
cd "$SCRIPT_DIR/backend"
[ ! -d "node_modules" ] && npm install
echo "Backend deps ready"

cd "$SCRIPT_DIR/frontend"
[ ! -d "node_modules" ] && npm install
echo "Frontend deps ready"

# 2. Check PostgreSQL
if ! pg_isready -h localhost -p 5432 -q; then
  echo "PostgreSQL is not running. Start it with: sudo systemctl start postgresql"
  exit 1
fi
echo "PostgreSQL running"

# 3. Ensure DB and user exist
sudo -u postgres psql -c "CREATE USER tender_user WITH PASSWORD 'tender_pass';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE tender_db OWNER tender_user;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE tender_db TO tender_user;" 2>/dev/null || true
echo "Database ready"

# 4. Sync schema
cd "$SCRIPT_DIR/backend"
npx prisma generate --schema=../database/prisma/schema.prisma
npx prisma db push --schema=../database/prisma/schema.prisma
echo "Schema synced"

# 5. Start services
cleanup() {
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

cd "$SCRIPT_DIR/backend" && npm run dev &
BACKEND_PID=$!

cd "$SCRIPT_DIR/frontend" && npm run dev &
FRONTEND_PID=$!

echo ""
echo "TenderIQ running"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:5000"
echo "Press Ctrl+C to stop."
echo ""

wait $BACKEND_PID $FRONTEND_PID
