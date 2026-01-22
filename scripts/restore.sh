#!/bin/bash
# Database restore script for SamSyn
# Restores PostgreSQL database from backup file

set -e

# Check if backup file is provided
if [ -z "$1" ]; then
  echo "Usage: ./restore.sh <backup_file>"
  echo ""
  echo "Available backups:"
  ls -lh /backups/*.sql.gz 2>/dev/null || echo "No backups found in /backups/"
  exit 1
fi

BACKUP_FILE=$1

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "═══════════════════════════════════════════════════════════"
echo "  WARNING: DATABASE RESTORE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "This will OVERWRITE the current database with:"
echo "  ${BACKUP_FILE}"
echo ""
echo "Current database: ${POSTGRES_DB}"
echo "Database user: ${POSTGRES_USER}"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
read -p "Are you sure you want to continue? Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled"
  exit 0
fi

echo ""
echo "[$(date)] Starting database restore..."

# Drop existing connections
echo "[$(date)] Terminating active connections..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql -h db -U "${POSTGRES_USER}" -d postgres <<EOF
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '${POSTGRES_DB}'
  AND pid <> pg_backend_pid();
EOF

# Drop and recreate database
echo "[$(date)] Dropping and recreating database..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql -h db -U "${POSTGRES_USER}" -d postgres <<EOF
DROP DATABASE IF EXISTS ${POSTGRES_DB};
CREATE DATABASE ${POSTGRES_DB};
EOF

# Restore backup
echo "[$(date)] Restoring from backup..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
  -h db \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --no-owner \
  --no-acl \
  --verbose \
  "${BACKUP_FILE}"

if [ $? -eq 0 ]; then
  echo ""
  echo "[$(date)] ✓ Database restored successfully!"
  echo ""
  echo "Next steps:"
  echo "  1. Restart the backend service: docker-compose -f docker-compose.prod.yml restart backend"
  echo "  2. Verify the application is working correctly"
  echo ""
else
  echo ""
  echo "[$(date)] ✗ ERROR: Database restore failed!"
  exit 1
fi
