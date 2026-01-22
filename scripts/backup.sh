#!/bin/bash
# Database backup script for SamSyn
# Runs automated PostgreSQL backups with retention policy

set -e

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="samsyn_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}

echo "[$(date)] Starting backup process..."

# Create backup directory if not exists
mkdir -p ${BACKUP_DIR}

# Run pg_dump with compression
echo "[$(date)] Creating backup: ${BACKUP_FILE}"
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h db \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --format=custom \
  --compress=9 \
  --file="${BACKUP_DIR}/${BACKUP_FILE}"

if [ $? -eq 0 ]; then
  echo "[$(date)] Backup created successfully: ${BACKUP_FILE}"
  BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
  echo "[$(date)] Backup size: ${BACKUP_SIZE}"
else
  echo "[$(date)] ERROR: Backup failed!"
  exit 1
fi

# Optional: Upload to S3
if [ ! -z "${BACKUP_S3_BUCKET}" ]; then
  echo "[$(date)] Uploading backup to S3..."
  aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}" "s3://${BACKUP_S3_BUCKET}/backups/${BACKUP_FILE}"
  if [ $? -eq 0 ]; then
    echo "[$(date)] Backup uploaded to S3 successfully"
  else
    echo "[$(date)] WARNING: S3 upload failed"
  fi
fi

# Optional: Upload to GCS
if [ ! -z "${BACKUP_GCS_BUCKET}" ]; then
  echo "[$(date)] Uploading backup to GCS..."
  gsutil cp "${BACKUP_DIR}/${BACKUP_FILE}" "gs://${BACKUP_GCS_BUCKET}/backups/${BACKUP_FILE}"
  if [ $? -eq 0 ]; then
    echo "[$(date)] Backup uploaded to GCS successfully"
  else
    echo "[$(date)] WARNING: GCS upload failed"
  fi
fi

# Clean old backups
echo "[$(date)] Cleaning old backups (retention: ${RETENTION_DAYS} days)..."
find ${BACKUP_DIR} -name "samsyn_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
REMAINING_BACKUPS=$(find ${BACKUP_DIR} -name "samsyn_backup_*.sql.gz" | wc -l)
echo "[$(date)] Remaining backups: ${REMAINING_BACKUPS}"

echo "[$(date)] Backup process completed successfully"
