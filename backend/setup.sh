#!/bin/bash
# Backend setup script for development

set -e

echo "🚀 Setting up SamSyn backend..."

# Check if we're in the backend directory
if [ ! -f "pyproject.toml" ]; then
    echo "❌ Error: Must be run from the backend directory"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source .venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -e .

echo "✅ Backend setup complete!"
echo ""
echo "Next steps:"
echo "1. Start the database: docker-compose up -d db (from repository root)"
echo "2. Run migrations: alembic upgrade head"
echo "3. Start the server: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "Or use npm scripts from repository root:"
echo "  npm run dev:backend - Start backend server"
echo "  npm run migrate - Run migrations"
