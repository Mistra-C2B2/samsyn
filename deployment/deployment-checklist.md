# Production Deployment Checklist

This checklist guides you through the complete deployment process for SamSyn in production with Traefik.

## Pre-Deployment (1-2 Weeks Before)

### Infrastructure Preparation

- [ ] **Server provisioned** - Ensure you have a server with:
  - Minimum: 4 CPU cores, 8GB RAM
  - 50-100GB SSD storage
  - Ubuntu 22.04 or Debian 12
  - SSH access configured

- [ ] **Traefik installed and configured**
  - [ ] Traefik is running (`docker ps | grep traefik`)
  - [ ] `traefik` Docker network exists (`docker network ls | grep traefik`)
  - [ ] Let's Encrypt certificate resolver configured
  - [ ] Traefik dashboard is accessible (optional)

- [ ] **DNS configured**
  - [ ] A record for `samsyn.yourdomain.com` points to server IP
  - [ ] DNS propagation verified (`dig samsyn.yourdomain.com`)
  - [ ] TTL is set appropriately (300-3600 seconds)

- [ ] **Firewall configured**
  - [ ] Ports 80 and 443 are open
  - [ ] SSH port is open (22 or custom)
  - [ ] SSH is restricted to trusted IPs (recommended)
  - [ ] All other ports are blocked

### Clerk Setup

- [ ] **Production Clerk application created**
  - [ ] Sign in to [Clerk Dashboard](https://dashboard.clerk.com)
  - [ ] Create new application for production
  - [ ] Note down production keys:
    - `CLERK_PUBLISHABLE_KEY` (starts with `pk_live_`)
    - `CLERK_SECRET_KEY` (starts with `sk_live_`)

- [ ] **Webhook configured** (if using webhooks)
  - [ ] Create webhook endpoint: `https://samsyn.yourdomain.com/api/webhooks/clerk`
  - [ ] Subscribe to relevant events (user.created, user.updated, etc.)
  - [ ] Note down `CLERK_WEBHOOK_SECRET`

- [ ] **JWKS URL obtained**
  - [ ] Get from Clerk dashboard: `https://your-app.clerk.accounts.dev/.well-known/jwks.json`

### Repository & Code

- [ ] **Code merged to main branch**
  - [ ] All features tested and working
  - [ ] No debug code or console.log statements
  - [ ] All tests passing
  - [ ] Code reviewed and approved

- [ ] **GitHub repository configured**
  - [ ] Repository is accessible from production server
  - [ ] Deploy keys added (if using private repository)

### Credentials Generated

- [ ] **Strong passwords generated**
  - [ ] PostgreSQL password (min 32 characters, random)
  - [ ] Store securely in password manager

- [ ] **Optional: External services**
  - [ ] Global Fishing Watch API token (if using)
  - [ ] S3/GCS credentials (if using off-site backups)

## Deployment Day

### Phase 1: Server Setup (30 minutes)

- [ ] **SSH into production server**
  ```bash
  ssh user@production-server
  ```

- [ ] **Install required dependencies**
  ```bash
  # Update system
  sudo apt update && sudo apt upgrade -y

  # Install Docker and Docker Compose V2 (if not already installed)
  sudo apt install -y docker.io docker-compose-v2 git

  # Add user to docker group
  sudo usermod -aG docker $USER

  # Re-login for group changes to take effect
  exit
  ssh user@production-server
  ```

- [ ] **Verify Traefik setup**
  ```bash
  # Check Traefik is running
  docker ps | grep traefik

  # Verify traefik network exists
  docker network ls | grep traefik

  # If not exists, create it
  docker network create traefik
  ```

- [ ] **Clone repository**
  ```bash
  sudo mkdir -p /opt/samsyn
  sudo chown $USER:$USER /opt/samsyn
  cd /opt
  git clone https://github.com/your-username/samsyn.git samsyn
  cd samsyn
  ```

### Phase 2: Configuration (15 minutes)

- [ ] **Create production environment file**
  ```bash
  cp .env.prod.example .env.prod
  ```

- [ ] **Edit .env.prod with production values**
  ```bash
  nano .env.prod
  ```

  Update the following:
  - [ ] `POSTGRES_PASSWORD` - Strong password generated earlier
  - [ ] `DOMAIN` - Your production domain (e.g., `samsyn.yourdomain.com`)
  - [ ] `VITE_CLERK_PUBLISHABLE_KEY` - Clerk production publishable key
  - [ ] `VITE_API_URL` - Full API URL (e.g., `https://samsyn.yourdomain.com/api`)
  - [ ] `CLERK_SECRET_KEY` - Clerk production secret key
  - [ ] `CLERK_PUBLISHABLE_KEY` - Clerk production publishable key
  - [ ] `CLERK_WEBHOOK_SECRET` - Clerk webhook secret (if using webhooks)
  - [ ] `CLERK_JWKS_URL` - Clerk JWKS URL from dashboard
  - [ ] `FRONTEND_URL` - Production frontend URL
  - [ ] `GFW_API_TOKEN` - Optional GFW token (if using Global Fishing Watch, server-side only)
  - [ ] `BACKUP_RETENTION_DAYS` - Backup retention (default: 7)
  - [ ] `BACKUP_S3_BUCKET` - Optional S3 bucket for off-site backups
  - [ ] `BACKUP_GCS_BUCKET` - Optional GCS bucket for off-site backups

- [ ] **Verify .env.prod is in .gitignore**
  ```bash
  cat .gitignore | grep .env.prod
  ```

- [ ] **Create backups directory**
  ```bash
  mkdir -p backups
  chmod 700 backups
  ```

### Phase 3: Build & Deploy (20-30 minutes)

- [ ] **Build Docker images**
  ```bash
  docker compose -f docker-compose.prod.yml build
  ```

  This may take 10-15 minutes for the first build.

- [ ] **Start services**
  ```bash
  docker compose -f docker-compose.prod.yml up -d
  ```

- [ ] **Verify all containers are running**
  ```bash
  docker compose -f docker-compose.prod.yml ps
  ```

  You should see:
  - samsyn-db-prod (healthy)
  - samsyn-titiler-prod (healthy)
  - samsyn-backend-prod (healthy)
  - samsyn-frontend-prod (healthy)
  - samsyn-backup-prod (running)

- [ ] **Check container logs for errors**
  ```bash
  # Check all logs
  docker compose -f docker-compose.prod.yml logs

  # Check specific service
  docker compose -f docker-compose.prod.yml logs backend
  docker compose -f docker-compose.prod.yml logs frontend
  ```

### Phase 4: Traefik Integration (10 minutes)

- [ ] **Verify Traefik discovered the services**
  ```bash
  # Check Traefik logs
  docker logs traefik 2>&1 | grep samsyn
  ```

  You should see logs about registering routes for samsyn-frontend and samsyn-backend.

- [ ] **Check Traefik dashboard** (if enabled)
  - Visit Traefik dashboard
  - Verify two routers exist:
    - `samsyn-frontend@docker` with rule `Host(samsyn.yourdomain.com)`
    - `samsyn-backend@docker` with rule `Host(samsyn.yourdomain.com) && (PathPrefix(/api) || ...)`

### Phase 5: Verification (20-30 minutes)

- [ ] **Health checks**
  ```bash
  # Frontend health
  curl https://samsyn.yourdomain.com/health
  # Should return: healthy

  # Backend health
  curl https://samsyn.yourdomain.com/api/health
  # Should return JSON with status

  # Database health (via backend)
  curl https://samsyn.yourdomain.com/api/health/db
  # Should return database connection status
  ```

- [ ] **SSL certificate verification**
  ```bash
  # Check certificate
  openssl s_client -connect samsyn.yourdomain.com:443 -servername samsyn.yourdomain.com < /dev/null

  # Verify certificate is from Let's Encrypt
  # Check expiration date is ~90 days in future
  ```

- [ ] **Test authentication**
  - Visit `https://samsyn.yourdomain.com`
  - Click "Sign In"
  - Verify Clerk authentication modal appears
  - Create test account or sign in with existing account
  - Verify redirect back to application
  - Check JWT token in browser dev tools (Application > Local Storage)

- [ ] **Test core functionality**
  - [ ] Create a new map
  - [ ] Add a layer (any type: WMS, GeoTIFF, vector)
  - [ ] Test map interactions (pan, zoom)
  - [ ] Test drawing tools
  - [ ] Add a comment
  - [ ] Test layer visibility toggle
  - [ ] Test layer opacity slider
  - [ ] Verify layer reordering works

- [ ] **Test API endpoints**
  ```bash
  # Swagger UI
  curl https://samsyn.yourdomain.com/docs
  # Should return HTML

  # ReDoc
  curl https://samsyn.yourdomain.com/redoc
  # Should return HTML

  # API endpoint (requires authentication)
  # Get auth token from browser and test:
  curl -H "Authorization: Bearer YOUR_TOKEN" \
    https://samsyn.yourdomain.com/api/v1/maps
  ```

- [ ] **Database migrations**
  ```bash
  # Check current migration version
  docker compose -f docker-compose.prod.yml exec backend alembic current

  # Should show current HEAD revision
  ```

- [ ] **Backup system**
  ```bash
  # Trigger manual backup
  docker compose -f docker-compose.prod.yml exec backup /backup.sh

  # Verify backup file created
  ls -lh backups/
  # Should see: samsyn_backup_YYYYMMDD_HHMMSS.sql.gz
  ```

### Phase 6: Post-Deployment Tasks (30 minutes)

- [ ] **Set up monitoring**
  - [ ] Configure uptime monitoring (UptimeRobot, Pingdom, etc.)
  - [ ] Add health check URL: `https://samsyn.yourdomain.com/health`
  - [ ] Configure alerts for downtime

- [ ] **Document deployment**
  - [ ] Record deployment date and time
  - [ ] Document any issues encountered and resolutions
  - [ ] Update deployment log

- [ ] **Notify stakeholders**
  - [ ] Send deployment notification
  - [ ] Provide production URL
  - [ ] Share any relevant release notes

- [ ] **Review security checklist**
  - [ ] Complete security hardening checklist (`security/hardening-checklist.md`)
  - [ ] Verify all items are checked

## Post-Deployment Monitoring

### First 24 Hours

- [ ] **Monitor continuously**
  - [ ] Check error logs every 2-4 hours
    ```bash
    docker compose -f docker-compose.prod.yml logs --tail=100 --follow
    ```
  - [ ] Monitor resource usage
    ```bash
    docker stats
    ```
  - [ ] Check disk space
    ```bash
    df -h
    ```

- [ ] **Verify backups are running**
  - [ ] Wait for first automated backup (runs at 2 AM)
  - [ ] Verify backup file was created
  - [ ] Check backup logs

- [ ] **Test all critical paths**
  - [ ] User registration
  - [ ] User login
  - [ ] Map creation
  - [ ] Layer upload
  - [ ] Commenting
  - [ ] Sharing/collaboration

### First Week

- [ ] **Daily log reviews**
  - [ ] Review error logs for anomalies
  - [ ] Check for failed requests
  - [ ] Monitor authentication errors

- [ ] **Performance monitoring**
  - [ ] Check page load times
  - [ ] Monitor API response times
  - [ ] Review database query performance

- [ ] **Resource optimization**
  - [ ] Adjust PostgreSQL settings if needed
  - [ ] Optimize Docker resource limits
  - [ ] Review and adjust backup retention

### First Month

- [ ] **Security audit**
  - [ ] Review access logs
  - [ ] Check for security vulnerabilities
  - [ ] Update dependencies if needed

- [ ] **Backup validation**
  - [ ] Test restore procedure on staging
  - [ ] Verify all backups are accessible
  - [ ] Check off-site backup uploads (if configured)

- [ ] **Documentation update**
  - [ ] Update runbooks with lessons learned
  - [ ] Document any configuration changes
  - [ ] Update troubleshooting guide

## Rollback Procedure

If deployment fails or critical issues are found:

1. **Stop services**
   ```bash
   docker compose -f docker-compose.prod.yml down
   ```

2. **Restore database** (if needed)
   ```bash
   ./scripts/restore.sh backups/last_good_backup.sql.gz
   ```

3. **Revert to previous version**
   ```bash
   git checkout <previous-commit-hash>
   docker compose -f docker-compose.prod.yml build
   docker compose -f docker-compose.prod.yml up -d
   ```

4. **Verify rollback**
   ```bash
   curl https://samsyn.yourdomain.com/health
   docker compose -f docker-compose.prod.yml logs
   ```

5. **Notify stakeholders**
   - Inform about rollback
   - Provide incident details
   - Share expected resolution time

## Emergency Contacts

**Infrastructure:**
- Name: _______________
- Phone: _______________
- Email: _______________

**Application:**
- Name: _______________
- Phone: _______________
- Email: _______________

**Database:**
- Name: _______________
- Phone: _______________
- Email: _______________

**On-Call Rotation:**
- [Document your on-call schedule]

## Notes

- Keep this checklist updated with lessons learned
- Review and improve the checklist after each deployment
- Assign clear ownership for each task
- Set realistic time estimates
- Always have a rollback plan ready
