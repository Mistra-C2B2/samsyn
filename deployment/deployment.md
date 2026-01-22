# SamSyn Production Deployment Guide

Complete guide for deploying SamSyn to production with Traefik reverse proxy.

## Overview

SamSyn is deployed using Docker containers orchestrated by Docker Compose, with Traefik handling SSL/TLS termination and routing. The deployment includes:

- **Frontend**: React + Vite app served by nginx
- **Backend**: FastAPI application with Python 3.11
- **Database**: PostgreSQL 16 + PostGIS 3.4
- **TiTiler**: GeoTIFF/COG tile server
- **Backup Service**: Automated daily database backups
- **Traefik**: Existing reverse proxy for SSL and routing

**Network Architecture:**
- **proxy** network: External network for Traefik communication (frontend & backend exposed)
- **samsyn-network**: Internal network for service-to-service communication (database & TiTiler isolated)

## Prerequisites

Before deploying, ensure you have:

### Infrastructure

- [ ] Server with minimum 4 CPU cores, 8GB RAM, 50-100GB SSD
- [ ] Ubuntu 22.04 or Debian 12
- [ ] Docker and Docker Compose installed
- [ ] Traefik v2.x or v3.x running with Let's Encrypt configured
- [ ] `proxy` Docker network created (external network for Traefik)
- [ ] SSH access configured

### Domain & DNS

- [ ] Domain name registered (e.g., `samsyn.yourdomain.com`)
- [ ] DNS A record pointing to server IP address
- [ ] DNS propagation verified

### Credentials

- [ ] Clerk production account created
- [ ] Clerk production keys obtained (`pk_live_*`, `sk_live_*`)
- [ ] Strong PostgreSQL password generated (min 32 characters)
- [ ] Optional: Global Fishing Watch API token
- [ ] Optional: S3/GCS credentials for off-site backups

## Quick Start

For experienced users who already have Traefik configured:

```bash
# 1. Clone repository
git clone https://github.com/your-username/samsyn.git /opt/samsyn
cd /opt/samsyn

# 2. Configure environment
cp .env.prod.example .env.prod
nano .env.prod  # Edit with your production values

# 3. Build and deploy
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# 4. Verify deployment
curl https://samsyn.yourdomain.com/health
docker-compose -f docker-compose.prod.yml logs -f
```

## Detailed Deployment Steps

### Step 1: Server Preparation

SSH into your production server:

```bash
ssh user@production-server
```

Update system and install dependencies (if not already installed):

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker (if needed)
sudo apt install -y docker.io docker-compose git

# Add user to docker group
sudo usermod -aG docker $USER

# Re-login for changes to take effect
exit
ssh user@production-server
```

Verify Traefik is running:

```bash
# Check Traefik container
docker ps | grep traefik

# Verify proxy network exists (used by Traefik)
docker network ls | grep proxy

# If network doesn't exist, create it
docker network create proxy
```

### Step 2: Clone Repository

Clone the SamSyn repository:

```bash
sudo mkdir -p /opt/samsyn
sudo chown $USER:$USER /opt/samsyn
cd /opt
git clone https://github.com/your-username/samsyn.git samsyn
cd samsyn
```

### Step 3: Configure Environment

Create production environment file:

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

Update the following variables:

#### Required Variables

```bash
# Database Configuration
POSTGRES_USER=samsyn
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD_HERE  # Min 32 chars, random
POSTGRES_DB=samsyn

# Domain
DOMAIN=samsyn.yourdomain.com  # Your actual domain

# Frontend Build Variables
VITE_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_KEY  # From Clerk dashboard
VITE_API_URL=https://samsyn.yourdomain.com/api  # Must match your domain

# Backend Variables
CLERK_SECRET_KEY=sk_live_YOUR_SECRET  # From Clerk dashboard
CLERK_PUBLISHABLE_KEY=pk_live_YOUR_KEY  # Same as above
CLERK_JWKS_URL=https://your-app.clerk.accounts.dev/.well-known/jwks.json
FRONTEND_URL=https://samsyn.yourdomain.com  # For CORS
```

#### Optional Variables

```bash
# Global Fishing Watch (optional)
VITE_GFW_API_TOKEN=your_gfw_token

# Webhook (if using Clerk webhooks)
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret

# Off-site Backups (optional)
BACKUP_S3_BUCKET=your-s3-bucket-name
BACKUP_GCS_BUCKET=your-gcs-bucket-name

# Backup Retention (default: 7 days)
BACKUP_RETENTION_DAYS=7
```

#### PostgreSQL Performance Tuning (optional)

Adjust based on available server resources:

```bash
POSTGRES_SHARED_BUFFERS=256MB  # 25% of RAM
POSTGRES_EFFECTIVE_CACHE_SIZE=1GB  # 50-75% of RAM
POSTGRES_WORK_MEM=16MB
POSTGRES_MAINTENANCE_WORK_MEM=128MB
```

**Important:** Verify `.env.prod` is in `.gitignore` to prevent committing secrets:

```bash
cat .gitignore | grep .env.prod
```

### Step 4: Create Directories and Set Permissions

Create backup directory and secure the backup script:

```bash
mkdir -p backups
chmod 700 backups
chmod 700 scripts/backup.sh
```

**Security Note:** The backup script contains database credentials and should only be readable and executable by the owner.

### Step 5: Build Docker Images

Build all Docker images:

```bash
docker-compose -f docker-compose.prod.yml build
```

This will take 10-15 minutes for the first build. The build process:

- Frontend: Installs npm dependencies, builds React app, creates nginx container
- Backend: Installs Python dependencies with uv, creates FastAPI container

### Step 6: Start Services

Start all services in detached mode:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

Services will start in order:

1. Database (PostgreSQL + PostGIS)
2. TiTiler
3. Backend (runs migrations automatically)
4. Frontend
5. Backup service

### Step 7: Verify Deployment

Check all containers are running:

```bash
docker-compose -f docker-compose.prod.yml ps
```

Expected output:

```
NAME                     STATUS              PORTS
samsyn-backend-prod      Up (healthy)
samsyn-backup-prod       Up
samsyn-db-prod           Up (healthy)
samsyn-frontend-prod     Up (healthy)
samsyn-titiler-prod      Up (healthy)
```

Check logs for errors:

```bash
# All services
docker-compose -f docker-compose.prod.yml logs

# Specific service
docker-compose -f docker-compose.prod.yml logs backend
docker-compose -f docker-compose.prod.yml logs frontend

# Follow logs in real-time
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 8: Verify Traefik Integration

Check Traefik discovered the services:

```bash
# Check Traefik logs
docker logs traefik 2>&1 | grep samsyn
```

You should see log entries about registering routes for `samsyn-frontend` and `samsyn-backend`.

If you have Traefik dashboard enabled, verify the routes are registered:

- `samsyn-frontend@docker` - Route: `Host(samsyn.yourdomain.com)`
- `samsyn-backend@docker` - Route: `Host(samsyn.yourdomain.com) && (PathPrefix(/api) || ...)`

### Step 9: Test Deployment

#### Health Checks

```bash
# Frontend health
curl https://samsyn.yourdomain.com/health
# Expected: healthy

# Backend health
curl https://samsyn.yourdomain.com/api/health
# Expected: {"status":"ok"}

# Database health (via backend)
curl https://samsyn.yourdomain.com/api/health/db
# Expected: {"database":"connected"}
```

#### SSL Certificate

```bash
# Verify SSL certificate
openssl s_client -connect samsyn.yourdomain.com:443 -servername samsyn.yourdomain.com < /dev/null 2>&1 | grep -A 2 "Verify return code"

# Should show: Verify return code: 0 (ok)
```

#### Application Testing

1. **Open application in browser:**

   ```
   https://samsyn.yourdomain.com
   ```

2. **Test authentication:**
   - Click "Sign In"
   - Verify Clerk modal appears
   - Sign in with test account
   - Verify successful redirect

3. **Test core functionality:**
   - Create a new map
   - Add a layer (WMS, GeoTIFF, or vector)
   - Test map interactions (pan, zoom)
   - Test drawing tools
   - Add a comment
   - Toggle layer visibility
   - Adjust layer opacity

4. **Test API documentation:**
   ```
   https://samsyn.yourdomain.com/docs  # Swagger UI
   https://samsyn.yourdomain.com/redoc  # ReDoc
   ```

#### Database Migrations

Verify migrations ran successfully:

```bash
docker-compose -f docker-compose.prod.yml exec backend alembic current
```

Should display the current migration revision (HEAD).

#### Backup System

Test the backup script:

```bash
# Trigger manual backup
docker-compose -f docker-compose.prod.yml exec backup /backup.sh

# Verify backup file was created
ls -lh backups/
```

You should see a file like `samsyn_backup_20260121_143000.sql.gz`.

## Post-Deployment Tasks

### 1. Set Up Monitoring

Configure uptime monitoring (UptimeRobot, Pingdom, etc.):

- Monitor URL: `https://samsyn.yourdomain.com/health`
- Check interval: 5 minutes
- Alert on downtime

### 2. Configure Alerts

Set up alerts for:

- Service downtime
- High resource usage (CPU, RAM, disk)
- Backup failures
- SSL certificate expiration (30 days before)

### 3. Review Security

Complete the security hardening checklist:

```bash
nano security/hardening-checklist.md
```

Key items to verify:

- [ ] All passwords are strong and unique
- [ ] `.env.prod` is not committed to git
- [ ] Database is not publicly accessible
- [ ] SSL/TLS is working correctly
- [ ] Rate limiting is configured (optional)
- [ ] Security headers are enabled (optional)

### 4. Document Deployment

Record important information:

- Deployment date and time
- Server IP address and hostname
- Domain name
- Any issues encountered and resolutions
- Emergency contact information

### 5. Schedule Backups Review

- Automated backups run daily at 2 AM
- Backups are retained for 7 days (configurable)
- Test restore procedure on staging environment
- Configure off-site backup uploads (S3/GCS) if needed

## Maintenance

### Viewing Logs

```bash
# View all logs
docker-compose -f docker-compose.prod.yml logs

# View logs for specific service
docker-compose -f docker-compose.prod.yml logs backend
docker-compose -f docker-compose.prod.yml logs frontend
docker-compose -f docker-compose.prod.yml logs db

# Follow logs in real-time
docker-compose -f docker-compose.prod.yml logs -f

# View last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100
```

### Updating the Application

After pushing code changes to your git repository, follow these steps to deploy updates to production.

#### Standard Update Procedure

```bash
# 1. SSH into production server
ssh user@production-server
cd /opt/samsyn

# 2. Create backup before update (recommended)
docker-compose -f docker-compose.prod.yml exec backup /backup.sh

# 3. Pull latest code from repository
git pull origin main

# 4. Review changes (optional but recommended)
git log -5 --oneline
git diff HEAD~1 HEAD

# 5. Rebuild Docker images with new code
docker-compose -f docker-compose.prod.yml build

# 6. Deploy updated services (zero-downtime restart)
docker-compose -f docker-compose.prod.yml up -d

# 7. Monitor deployment
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f backend frontend
```

#### What Happens During Update

1. **git pull** - Downloads latest code changes from repository
2. **build** - Rebuilds affected Docker images:
   - **Frontend**: Runs `npm install` and `vite build` with latest code
   - **Backend**: Installs Python dependencies and packages new code
   - Unchanged services are not rebuilt (Docker uses layer caching)
3. **up -d** - Recreates containers with new images:
   - Docker keeps old containers running until new ones pass healthchecks
   - Minimal downtime (typically < 5 seconds)
   - Backend runs database migrations automatically on startup
   - Healthchecks ensure services are ready before routing traffic

#### Selective Service Updates

Update only specific services to save time:

```bash
# Update only backend
docker-compose -f docker-compose.prod.yml build backend
docker-compose -f docker-compose.prod.yml up -d backend

# Update only frontend
docker-compose -f docker-compose.prod.yml build frontend
docker-compose -f docker-compose.prod.yml up -d frontend

# Verify specific service
docker-compose -f docker-compose.prod.yml logs -f backend
```

#### Post-Update Verification

```bash
# 1. Check all services are healthy
docker-compose -f docker-compose.prod.yml ps

# Expected output: All services show "Up (healthy)"

# 2. Test application endpoints
curl https://yourdomain.com/health
# Expected: "healthy"

curl https://yourdomain.com/api/health
# Expected: {"status":"ok"}

# 3. Test authentication and core features
# - Open https://yourdomain.com in browser
# - Sign in with Clerk
# - Create a map, add layers, test interactions

# 4. Monitor logs for errors
docker-compose -f docker-compose.prod.yml logs --tail=100 backend
docker-compose -f docker-compose.prod.yml logs --tail=100 frontend

# 5. Check resource usage
docker stats
```

#### Troubleshooting Failed Updates

**If services fail to start:**

```bash
# Check logs for error messages
docker-compose -f docker-compose.prod.yml logs backend
docker-compose -f docker-compose.prod.yml logs frontend

# Common issues:
# - Build errors: Check syntax in modified files
# - Migration errors: Check backend logs, may need manual migration fix
# - Environment variables: Verify .env.prod has all required variables
# - Port conflicts: Check if ports are already in use
```

**If database migrations fail:**

```bash
# Check migration status
docker-compose -f docker-compose.prod.yml exec backend alembic current

# View migration history
docker-compose -f docker-compose.prod.yml exec backend alembic history

# Apply migrations manually if needed
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

**If application behaves incorrectly:**

```bash
# Check environment variables are correct
docker-compose -f docker-compose.prod.yml exec backend env | grep -E 'DATABASE_URL|CLERK|FRONTEND_URL'
docker-compose -f docker-compose.prod.yml exec frontend env | grep VITE

# Verify database connectivity
docker-compose -f docker-compose.prod.yml exec backend python -c "from sqlalchemy import create_engine; import os; engine = create_engine(os.getenv('DATABASE_URL')); print('Connected:', engine.connect())"

# Force rebuild without cache (last resort)
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Restarting Services

```bash
# Restart all services
docker-compose -f docker-compose.prod.yml restart

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend
docker-compose -f docker-compose.prod.yml restart frontend
```

### Stopping Services

```bash
# Stop all services (keeps data)
docker-compose -f docker-compose.prod.yml stop

# Stop and remove containers (keeps data)
docker-compose -f docker-compose.prod.yml down

# Stop and remove everything including volumes (DESTRUCTIVE)
docker-compose -f docker-compose.prod.yml down -v
```

### Database Backup and Restore

#### Manual Backup

```bash
docker-compose -f docker-compose.prod.yml exec backup /backup.sh
```

#### Restore from Backup

```bash
# List available backups
ls -lh backups/

# Restore from backup (CAUTION: overwrites database)
./scripts/restore.sh backups/samsyn_backup_YYYYMMDD_HHMMSS.sql.gz
```

### Resource Monitoring

```bash
# Monitor container resource usage
docker stats

# Check disk usage
df -h

# Check backup disk usage
du -sh backups/
```

## Troubleshooting

### Services Won't Start

**Check logs:**

```bash
docker-compose -f docker-compose.prod.yml logs
```

**Common issues:**

- Port conflicts: Another service using ports 80/443
- Database connection: Check `POSTGRES_PASSWORD` is correct
- Traefik network: Ensure `proxy` network exists
- Build failures: Check for syntax errors in Dockerfiles

### Can't Access Application via Domain

**Verify DNS:**

```bash
dig samsyn.yourdomain.com
# Should show your server IP
```

**Check Traefik routing:**

```bash
docker logs traefik | grep samsyn
docker network inspect proxy | grep samsyn
```

**Verify containers are on proxy network:**

```bash
docker inspect samsyn-frontend-prod | grep -A 5 Networks
docker inspect samsyn-backend-prod | grep -A 5 Networks
```

### SSL Certificate Issues

**Check Let's Encrypt validation:**

```bash
docker logs traefik | grep -i certificate
```

**Verify ports 80 and 443 are accessible:**

```bash
# From external machine
telnet samsyn.yourdomain.com 80
telnet samsyn.yourdomain.com 443
```

**Wait for certificate issuance:**
Let's Encrypt validation can take 2-5 minutes. Check Traefik logs.

### Frontend Shows 404 for API Calls

**Verify backend is accessible:**

```bash
curl https://samsyn.yourdomain.com/api/health
```

**Check VITE_API_URL:**
Ensure `.env.prod` has correct `VITE_API_URL`. If changed, rebuild frontend:

```bash
docker-compose -f docker-compose.prod.yml build frontend
docker-compose -f docker-compose.prod.yml up -d frontend
```

### Database Connection Errors

**Test database connectivity:**

```bash
docker-compose -f docker-compose.prod.yml exec backend ping db
```

**Check database is healthy:**

```bash
docker-compose -f docker-compose.prod.yml ps db
```

**Verify credentials:**

```bash
docker-compose -f docker-compose.prod.yml exec backend env | grep DATABASE_URL
```

### High Resource Usage

**Check container stats:**

```bash
docker stats
```

**Adjust PostgreSQL settings:**
Edit `.env.prod` and adjust `POSTGRES_SHARED_BUFFERS`, `POSTGRES_EFFECTIVE_CACHE_SIZE`, etc., then restart:

```bash
docker-compose -f docker-compose.prod.yml restart db
```

## Rollback Procedure

If an update causes critical issues, follow this rollback procedure to restore the previous working version.

### When to Rollback

- Services fail to start after update
- Critical bugs discovered in production
- Database migrations cannot be completed
- Significant performance degradation
- Security vulnerability introduced

### Quick Rollback (Code Only)

If the issue is only with application code (no database schema changes):

```bash
cd /opt/samsyn

# 1. Find the last working commit
git log --oneline -10
# Note the commit hash of the last working version

# 2. Revert to previous version
git checkout <previous-commit-hash>

# 3. Rebuild and restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# 4. Verify rollback
curl https://yourdomain.com/health
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f
```

### Full Rollback (Code + Database)

If database schema changed and needs to be restored:

```bash
cd /opt/samsyn

# 1. Stop all services
docker-compose -f docker-compose.prod.yml down

# 2. List available backups
ls -lh backups/

# 3. Restore database from backup
# Find the backup from before the problematic update
./scripts/restore.sh backups/samsyn_backup_YYYYMMDD_HHMMSS.sql.gz

# 4. Revert code to previous version
git log --oneline -10
git checkout <previous-commit-hash>

# 5. Rebuild and restart all services
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# 6. Verify rollback
docker-compose -f docker-compose.prod.yml ps
curl https://yourdomain.com/health
curl https://yourdomain.com/api/health

# 7. Monitor logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Rollback Without Downtime (Hot Rollback)

If you need to minimize downtime:

```bash
# 1. Don't stop services, just revert code
git checkout <previous-commit-hash>

# 2. Rebuild images
docker-compose -f docker-compose.prod.yml build

# 3. Rolling restart (Docker keeps old containers until new ones are healthy)
docker-compose -f docker-compose.prod.yml up -d

# 4. Monitor the rollback
docker-compose -f docker-compose.prod.yml logs -f
```

### After Rollback

```bash
# 1. Return to main branch and reset (if you want to keep working on main)
git checkout main
git reset --hard <previous-commit-hash>

# 2. Or create a revert commit (safer, preserves history)
git checkout main
git revert <bad-commit-hash>
git push origin main

# 3. Investigate what went wrong
docker-compose -f docker-compose.prod.yml logs > rollback_investigation.log

# 4. Fix issues in development/staging before re-deploying

# 5. Document the incident
# - What went wrong
# - When it was detected
# - How it was resolved
# - How to prevent in the future
```

### Emergency Contact Information

Keep this information readily available:

- Server IP and SSH access details
- Database backup location: `/opt/samsyn/backups/`
- Restore script location: `/opt/samsyn/scripts/restore.sh`
- Last known good commit hash (update after each successful deployment)
- Off-site backup location (if configured: S3/GCS)

## Continuous Integration with GitHub Actions

The repository includes a GitHub Actions workflow that automatically runs tests on every push and pull request. This ensures code quality before deployment.

### Test Workflow

The workflow (`.github/workflows/test.yml`) runs automatically on:
- Push to `main` or `new-frontend` branches
- Pull requests to `main`
- Manual trigger via GitHub Actions UI

**What gets tested:**
1. **Backend Tests**: Runs pytest suite with Python 3.11
2. **Frontend Linting**: Runs Biome linter and formatter checks
3. **Secret Scanning**: Runs Gitleaks to detect accidentally committed secrets
4. **Test Summary**: Reports overall pass/fail status

View test results: Go to your GitHub repository → `Actions` tab

### Test Workflow Status Badge

Add this badge to your README to show test status:

```markdown
![Tests](https://github.com/your-username/samsyn/actions/workflows/test.yml/badge.svg)
```

### Running Tests Locally

Before pushing code, run tests locally to catch issues early:

```bash
# Backend tests
cd backend
uv sync
uv run pytest tests/ -v

# Frontend linting and formatting
cd frontend
npm ci
npm run lint
npm run format
npm run check  # Runs both lint and format with auto-fix

# Secret scanning with Gitleaks (optional but recommended)
# Install gitleaks: https://github.com/gitleaks/gitleaks#installing
gitleaks detect --source . --config .github/.gitleaks.toml --verbose
```

**Note**: Gitleaks scans your repository for accidentally committed secrets like API keys, passwords, and tokens. If it finds any, remove them from git history before pushing to production.

### Deployment Process

**SamSyn uses manual deployment** for better control and safety. After your code passes tests, deploy manually by following the "Updating the Application" section above.

**Why manual deployment:**
- Full control over when updates happen
- Can create backups before updating
- Can review changes before deploying
- Reduces risk of automated deployments breaking production
- Allows for gradual rollouts and testing

If you prefer automated deployment, you can extend the test workflow to include deployment steps using SSH actions (see GitHub Actions documentation for examples).

## Additional Resources

- **Security Hardening Checklist**: `security/hardening-checklist.md` - Complete security review checklist
- **Backend API Documentation**: `backend/README.md` - API endpoints and documentation
- **Project Overview**: `CLAUDE.md` - Development setup and architecture
- **GitHub Issues**: Report bugs or request features

## Support

For issues or questions:

- GitHub Issues: https://github.com/your-username/samsyn/issues
- Documentation: Check files in `docs/` directory
- Logs: Always check container logs first for error messages

## Architecture Overview

```
Internet
   ↓
Traefik (ports 80, 443)
   ↓
┌─────────────────┬────────────────┐
│                 │                │
Frontend (nginx)  Backend (FastAPI)  [Both on proxy network]
   ↓                 ↓
   └─────────┬───────┘
             ↓
   Internal Network (samsyn-network)
             ↓
    ┌────────┼────────┐
    ↓        ↓        ↓
Database  TiTiler  Backup
```

## Resource Requirements

- **Frontend**: 0.25 CPU, 128MB RAM
- **Backend**: 1 CPU, 1GB RAM
- **Database**: 1 CPU, 2GB RAM, 10-50GB storage
- **TiTiler**: 0.5 CPU, 512MB RAM
- **Backup**: 0.25 CPU, 128MB RAM
- **Total**: ~3 CPU, ~4GB RAM, 10-50GB storage

Recommended server: 4 CPU cores, 8GB RAM, 50-100GB SSD

## Security Notes

- Never commit `.env.prod` to version control
- Use strong, unique passwords (min 32 characters)
- Restrict permissions on sensitive files (`chmod 700 backups/`, `chmod 700 scripts/backup.sh`)
- Keep Docker and dependencies updated
- Regular security audits recommended
- Enable Traefik access logs for security monitoring
- Configure rate limiting via Traefik middleware
- Review security checklist before deployment

## License

[Your License Here]
