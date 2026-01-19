#!/bin/bash
# Script to set up the test database

set -e

echo "🗄️  Setting up test database..."

# Check if we can connect to the database
if ! command -v psql &> /dev/null; then
    echo "❌ psql not found. Install postgresql-client or run this inside the database container."
    exit 1
fi

# Database connection details
DB_HOST="${DB_HOST:-samsyn-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-samsyn}"
DB_NAME="${DB_NAME:-samsyn_test}"
PGPASSWORD="${PGPASSWORD:-samsyn}"

export PGPASSWORD

echo "📊 Creating database: $DB_NAME"

# Try to create the database (will fail if it already exists, that's ok)
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || \
    echo "ℹ️  Database $DB_NAME already exists"

echo "🗺️  Enabling PostGIS extension..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS postgis;"

echo "🔄 Running migrations on test database..."

# Temporarily override DATABASE_URL to point to test database for migrations
TEST_DB_URL="postgresql://$DB_USER:$PGPASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"

# Create a temporary .env file with the test database URL
TEMP_ENV=$(mktemp)
cat .env | grep -v "^DATABASE_URL=" > "$TEMP_ENV" || true
echo "DATABASE_URL=$TEST_DB_URL" >> "$TEMP_ENV"

# Run migrations using the temporary .env
mv .env .env.backup
mv "$TEMP_ENV" .env

uv run alembic upgrade head

# Restore original .env
mv .env.backup .env

echo "✅ Test database setup complete!"
echo ""
echo "Test database URL: postgresql://$DB_USER:****@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""
echo "You can now run tests safely without affecting your development database:"
echo "  uv run pytest tests/"
