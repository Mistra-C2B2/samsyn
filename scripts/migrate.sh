#!/bin/bash
# Database migration script for SamSyn
# Runs Alembic migrations in production

set -e

echo "[$(date)] Starting database migration..."

# Wait for database to be ready
echo "[$(date)] Waiting for database to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

until PGPASSWORD="${POSTGRES_PASSWORD}" psql -h db -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c '\q' 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ ${RETRY_COUNT} -ge ${MAX_RETRIES} ]; then
    echo "[$(date)] ERROR: Database not available after ${MAX_RETRIES} attempts"
    exit 1
  fi
  echo "[$(date)] Database not ready yet. Retrying in 2 seconds... (${RETRY_COUNT}/${MAX_RETRIES})"
  sleep 2
done

echo "[$(date)] Database is ready!"

# Run migrations
echo "[$(date)] Running Alembic migrations..."
cd /app
alembic upgrade head

if [ $? -eq 0 ]; then
  echo "[$(date)] ✓ Migrations completed successfully"
else
  echo "[$(date)] ✗ ERROR: Migrations failed!"
  exit 1
fi
