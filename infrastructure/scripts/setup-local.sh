#!/bin/bash
set -e

echo "=== Racing Coach MVP — Local Setup ==="
echo ""

# 1. Check prerequisites
echo "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || { echo "Docker is required. Install from https://docs.docker.com/get-docker/"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required. Install from https://nodejs.org/"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required."; exit 1; }

echo "  Docker: $(docker --version)"
echo "  Node: $(node --version)"
echo "  Python: $(python3 --version)"

# 2. Copy .env
if [ ! -f .env ]; then
  echo ""
  echo "Creating .env from .env.example..."
  cp .env.example .env
  echo "  Edit .env to add your API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY)"
fi

# 3. Start infrastructure services
echo ""
echo "Starting infrastructure (PostgreSQL, Redis, MinIO)..."
docker compose up -d postgres redis minio minio-setup

# Wait for services
echo "Waiting for services to be healthy..."
sleep 5

# 4. Install Node.js dependencies
echo ""
echo "Installing Node.js dependencies..."
npm install

# 5. Generate Prisma client and push schema
echo ""
echo "Setting up database..."
npm run db:generate
npm run db:push

# 6. Seed database with tracks
echo ""
echo "Seeding database with tracks..."
npm run db:seed

# 7. Set up Python venv
echo ""
echo "Setting up Python environment..."
cd services/analysis
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
deactivate
cd ../..

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To run the application:"
echo ""
echo "  Terminal 1 (Next.js):     npm run dev --workspace=apps/web"
echo "  Terminal 2 (Analysis):    cd services/analysis && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000"
echo "  Terminal 3 (Worker):      cd services/analysis && source .venv/bin/activate && python -m app.worker"
echo ""
echo "  Infrastructure:           docker compose up -d postgres redis minio"
echo "  MinIO Console:            http://localhost:9001 (minioadmin/minioadmin)"
echo "  Prisma Studio:            npm run db:studio"
echo ""
