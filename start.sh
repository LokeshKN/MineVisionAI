#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

GREEN='\033[0;32m'
AMBER='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${AMBER}  ███╗   ███╗██╗███╗   ██╗███████╗${NC}"
echo -e "${AMBER}  ████╗ ████║██║████╗  ██║██╔════╝${NC}"
echo -e "${AMBER}  ██╔████╔██║██║██╔██╗ ██║█████╗  ${NC}"
echo -e "${AMBER}  ██║╚██╔╝██║██║██║╚██╗██║██╔══╝  ${NC}"
echo -e "${AMBER}  ██║ ╚═╝ ██║██║██║ ╚████║███████╗${NC}"
echo -e "  MineVisionAI Demo — v1.0.0"
echo ""

# Kill any existing processes
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# Backend
echo -e "${BLUE}[1/2]${NC} Starting FastAPI backend on :8000..."
cd "$BACKEND"
python3 -m uvicorn main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --log-level warning \
  --reload \
  > /tmp/mvai-backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend
for i in $(seq 1 10); do
  sleep 1
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Backend ready (PID $BACKEND_PID)"
    break
  fi
  if [ $i -eq 10 ]; then
    echo "  ✗ Backend failed to start. Check /tmp/mvai-backend.log"
    cat /tmp/mvai-backend.log
    exit 1
  fi
done

# Frontend
echo -e "${BLUE}[2/2]${NC} Starting React frontend on :5173..."
cd "$FRONTEND"
npm run dev > /tmp/mvai-frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 3

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}✓${NC}  App:      ${AMBER}http://localhost:5173${NC}"
echo -e "  ${GREEN}✓${NC}  API:      http://localhost:8000"
echo -e "  ${GREEN}✓${NC}  API Docs: http://localhost:8000/docs"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Login:    admin@minevisionai.in"
echo -e "  Password: demo1234"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

cleanup() {
  echo ""
  echo "Stopping servers..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

wait
