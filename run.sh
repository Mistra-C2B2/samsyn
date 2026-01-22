#!/bin/bash
# SamSyn project management script

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Help text
show_help() {
    echo "Usage: ./run.sh <command> [args]"
    echo ""
    echo "Commands:"
    echo "  install           Install all dependencies (frontend + backend)"
    echo "  dev               Start frontend dev server"
    echo "  dev-backend       Start backend dev server"
    echo "  build             Build frontend for production"
    echo "  lint              Run linter on frontend code"
    echo "  format            Format frontend code"
    echo "  check             Lint and format frontend code (auto-fix)"
    echo "  migrate           Run database migrations"
    echo "  migrate-new MSG   Create new migration with message"
    echo "  help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./run.sh install"
    echo "  ./run.sh dev"
    echo "  ./run.sh migrate-new \"add user table\""
}

# Check if command provided
if [ -z "$1" ]; then
    show_help
    exit 1
fi

COMMAND=$1
shift # Remove first argument, leaving any remaining args

case $COMMAND in
    install)
        echo -e "${GREEN}Installing frontend dependencies...${NC}"
        cd "$SCRIPT_DIR/frontend" && npm install
        echo -e "${GREEN}Installing backend dependencies...${NC}"
        cd "$SCRIPT_DIR/backend" && uv sync
        echo -e "${GREEN}Installation complete!${NC}"
        ;;

    dev)
        echo -e "${GREEN}Starting frontend dev server...${NC}"
        cd "$SCRIPT_DIR/frontend" && npm run dev
        ;;

    dev-backend)
        echo -e "${GREEN}Starting backend dev server...${NC}"
        cd "$SCRIPT_DIR/backend" && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
        ;;

    build)
        echo -e "${GREEN}Building frontend for production...${NC}"
        cd "$SCRIPT_DIR/frontend" && npm run build
        ;;

    lint)
        echo -e "${GREEN}Running linter...${NC}"
        cd "$SCRIPT_DIR/frontend" && npx biome lint ./src
        ;;

    format)
        echo -e "${GREEN}Formatting code...${NC}"
        cd "$SCRIPT_DIR/frontend" && npx biome format --write ./src
        ;;

    check)
        echo -e "${GREEN}Linting and formatting code...${NC}"
        cd "$SCRIPT_DIR/frontend" && npx biome check --write ./src
        ;;

    migrate)
        echo -e "${GREEN}Running database migrations...${NC}"
        cd "$SCRIPT_DIR/backend" && uv run alembic upgrade head
        ;;

    migrate-new)
        if [ -z "$1" ]; then
            echo -e "${RED}Error: Please provide a migration message${NC}"
            echo "Usage: ./run.sh migrate-new \"migration message\""
            exit 1
        fi
        echo -e "${GREEN}Creating new migration: $1${NC}"
        cd "$SCRIPT_DIR/backend" && uv run alembic revision --autogenerate -m "$1"
        ;;

    help)
        show_help
        ;;

    *)
        echo -e "${RED}Error: Unknown command '$COMMAND'${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
