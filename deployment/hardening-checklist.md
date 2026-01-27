# Security Hardening Checklist

## Pre-Deployment Security Review

### Credentials & Secrets
- [ ] Generate strong PostgreSQL password (min 32 characters, random)
- [ ] Update all `.env` files with production credentials
- [ ] Verify no `.env` files are committed to git (.gitignore configured)
- [ ] Run Gitleaks scan to detect accidentally committed secrets (`gitleaks detect --source . --config .github/.gitleaks.toml --verbose`)
- [ ] Use production Clerk credentials (`pk_live_*`, `sk_live_*`)
- [ ] Store sensitive environment variables securely (consider HashiCorp Vault or cloud secrets manager)
- [ ] Enable Clerk webhook signature verification
- [ ] Rotate all development/staging credentials

### File Permissions & Access Control
- [ ] Restrict permissions on backup script (`chmod 700 scripts/backup.sh`)
- [ ] Restrict permissions on backup directory (`chmod 700 backups/`)
- [ ] Verify `.env` has restrictive permissions (`chmod 600 .env`)
- [ ] Ensure sensitive scripts are owned by deployment user only
- [ ] Review permissions on all mounted volumes in docker-compose

### Network & Infrastructure
- [ ] Verify Traefik is configured with Let's Encrypt
- [ ] Ensure DNS A record points to production server
- [ ] Configure firewall rules (allow only 80, 443, SSH from trusted IPs)
- [ ] Verify `traefik` Docker network exists and is properly configured
- [ ] Disable direct database port exposure (5432 should not be public)
- [ ] Review Traefik access logs location and retention

### SSL/TLS Configuration
- [ ] Verify Let's Encrypt certificate resolver is configured in Traefik
- [ ] Test SSL certificate issuance on staging first
- [ ] Enable HSTS headers via Traefik middleware
- [ ] Configure minimum TLS version (1.2 or higher)
- [ ] Verify certificate auto-renewal is working

## Database Security

### PostgreSQL Configuration
- [ ] Use strong, unique password for PostgreSQL
- [ ] Disable remote PostgreSQL access (internal Docker network only)
- [ ] Enable PostgreSQL SSL/TLS for internal connections (optional but recommended)
- [ ] Configure `pg_hba.conf` for strict authentication (if needed)
- [ ] Enable PostgreSQL audit logging (optional)
- [ ] Set appropriate connection limits
- [ ] Configure statement timeout to prevent long-running queries

### Backup Security
- [ ] Test backup script on staging environment
- [ ] Restrict permissions on backup script (`chmod 700 scripts/backup.sh`)
- [ ] Restrict permissions on backup directory (`chmod 700 backups/`)
- [ ] Verify backups are encrypted at rest
- [ ] Configure off-site backup storage (S3/GCS)
- [ ] Test restore procedure at least once before production
- [ ] Set appropriate backup retention policy (7-30 days)
- [ ] Restrict access to backup files (secure S3 bucket policies)
- [ ] Document backup and recovery procedures

## Application Security

### Backend Configuration
- [ ] Set `DEV_MODE=false` in production
- [ ] Configure CORS to allow only production domain (no wildcards)
- [ ] Verify all API endpoints require authentication
- [ ] Enable request size limits (configured in nginx: 100MB)
- [ ] Implement rate limiting via Traefik middleware
- [ ] Disable debug mode and verbose error messages
- [ ] Remove or secure Swagger/ReDoc endpoints (or require authentication)
- [ ] Validate all user inputs server-side
- [ ] Use parameterized SQL queries (SQLAlchemy already does this)
- [ ] Implement proper error handling (no stack traces to users)

### Frontend Configuration
- [ ] Verify `VITE_API_URL` points to production backend
- [ ] Use production Clerk publishable key
- [ ] Remove any debug logging or console.log statements
- [ ] Verify no sensitive data in localStorage/sessionStorage
- [ ] Implement Content Security Policy headers via Traefik
- [ ] Enable XSS protection headers

### Authentication & Authorization
- [ ] Verify Clerk webhooks are configured and signed
- [ ] Test authentication flow end-to-end
- [ ] Verify JWT validation in backend
- [ ] Implement proper role-based access control (RBAC)
- [ ] Test admin panel access controls
- [ ] Verify session timeout is configured appropriately

## Docker Security

### Container Hardening
- [ ] Use non-root users in all containers
- [ ] Minimize image layers and dependencies
- [ ] Use specific image tags (not `:latest`)
- [ ] Scan images for vulnerabilities (`docker scan` or Trivy)
- [ ] Use read-only filesystems where possible
- [ ] Limit container resources (CPU, memory) in docker-compose
- [ ] Remove unnecessary tools from production images
- [ ] Use multi-stage builds to minimize final image size

### Docker Configuration
- [ ] Ensure Docker daemon is up to date
- [ ] Configure Docker to use user namespaces (if possible)
- [ ] Restrict Docker socket access
- [ ] Enable Docker Content Trust (optional)
- [ ] Use Docker secrets or encrypted environment variables
- [ ] Review and minimize Docker capabilities (`--cap-drop`)

## Traefik Security

### Traefik Configuration
- [ ] Verify Traefik dashboard is secured with authentication
- [ ] Enable access logs for security monitoring
- [ ] Configure rate limiting middleware for API endpoints
- [ ] Add security headers middleware (HSTS, X-Frame-Options, etc.)
- [ ] Implement IP whitelisting for admin endpoints (if needed)
- [ ] Configure request size limits
- [ ] Enable compression middleware for performance
- [ ] Verify Docker socket is mounted read-only

### Middleware Configuration
```yaml
# Example security headers middleware
- "traefik.http.middlewares.samsyn-headers.headers.sslredirect=true"
- "traefik.http.middlewares.samsyn-headers.headers.stsSeconds=31536000"
- "traefik.http.middlewares.samsyn-headers.headers.frameDeny=true"
- "traefik.http.middlewares.samsyn-headers.headers.contentTypeNosniff=true"

# Example rate limiting
- "traefik.http.middlewares.samsyn-ratelimit.ratelimit.average=100"
- "traefik.http.middlewares.samsyn-ratelimit.ratelimit.burst=50"
```

## Network Security

### Docker Networks
- [ ] Verify internal services are on `samsyn-network` only
- [ ] Verify frontend/backend are on both `samsyn-network` and `traefik`
- [ ] Ensure database and TiTiler are NOT on `traefik` network
- [ ] Test that database is not accessible from outside Docker network
- [ ] Verify network isolation between different applications

### DDoS Protection
- [ ] Configure rate limiting in Traefik
- [ ] Consider using Cloudflare for additional DDoS protection
- [ ] Set connection limits in nginx/Traefik
- [ ] Monitor for unusual traffic patterns
- [ ] Implement CAPTCHA for public endpoints (if needed)

## Monitoring & Logging

### Application Monitoring
- [ ] Set up health check endpoints (`/health`)
- [ ] Configure uptime monitoring (UptimeRobot, Pingdom, etc.)
- [ ] Set up error tracking (Sentry, Rollbar)
- [ ] Monitor application performance (APM tools)
- [ ] Configure alerts for critical errors
- [ ] Monitor disk usage (especially for database and backups)

### Log Management
- [ ] Configure centralized logging (optional: ELK, Loki, CloudWatch)
- [ ] Set log retention policies
- [ ] Monitor logs for security events
- [ ] Ensure logs don't contain sensitive data (passwords, tokens)
- [ ] Set up log rotation for Docker containers
- [ ] Configure alerts for suspicious activity

### Security Monitoring
- [ ] Monitor failed authentication attempts
- [ ] Track API rate limit violations
- [ ] Monitor database connection attempts
- [ ] Set up alerts for unusual database queries
- [ ] Monitor SSL certificate expiration
- [ ] Track container resource usage

## Backup & Disaster Recovery

### Backup Strategy
- [ ] Verify automated daily backups are running
- [ ] Test backup script manually before production
- [ ] Configure off-site backup storage
- [ ] Encrypt backups at rest and in transit
- [ ] Document backup retention policy
- [ ] Set up backup monitoring and alerts

### Disaster Recovery
- [ ] Test full restore procedure on staging
- [ ] Document recovery time objective (RTO)
- [ ] Document recovery point objective (RPO)
- [ ] Create runbook for common failure scenarios
- [ ] Test rollback procedure
- [ ] Document emergency contacts and procedures
- [ ] Keep offline copy of critical credentials

## Compliance & Auditing

### Audit Logging
- [ ] Enable database audit logs (if required)
- [ ] Log all administrative actions
- [ ] Track data access and modifications
- [ ] Retain audit logs according to compliance requirements
- [ ] Implement log integrity checks

### Data Protection
- [ ] Implement data retention policies
- [ ] Enable data encryption at rest (PostgreSQL)
- [ ] Enable data encryption in transit (SSL/TLS)
- [ ] Implement data backup and recovery procedures
- [ ] Document data handling procedures

## Post-Deployment Security Tasks

### Immediate (First 24 Hours)
- [ ] Monitor error logs continuously
- [ ] Verify all services are healthy
- [ ] Test SSL certificate validity
- [ ] Verify backups are running
- [ ] Test authentication and authorization
- [ ] Monitor resource usage

### First Week
- [ ] Review access logs for anomalies
- [ ] Verify rate limiting is working
- [ ] Test security headers are being sent
- [ ] Monitor database performance
- [ ] Review and tune resource limits
- [ ] Verify Traefik metrics are being collected

### First Month
- [ ] Conduct security audit
- [ ] Perform penetration testing (if budget allows)
- [ ] Review and update security policies
- [ ] Test backup restore procedure
- [ ] Review and optimize resource usage
- [ ] Update documentation with lessons learned

## Regular Maintenance

### Weekly
- [ ] Review error logs
- [ ] Check backup success/failure
- [ ] Monitor disk usage
- [ ] Review security alerts

### Monthly
- [ ] Update Docker images with security patches
- [ ] Review access logs for anomalies
- [ ] Test backup restore procedure
- [ ] Review and rotate credentials (if needed)
- [ ] Update dependencies with security patches

### Quarterly
- [ ] Security audit and penetration testing
- [ ] Review and update security policies
- [ ] Disaster recovery drill
- [ ] Performance review and optimization
- [ ] Update runbooks and documentation

## Security Incident Response Plan

### Preparation
- [ ] Document incident response procedures
- [ ] Define roles and responsibilities
- [ ] Create communication plan
- [ ] Set up incident tracking system
- [ ] Prepare contact list (team, vendors, authorities)

### Detection & Analysis
- [ ] Monitor for security events
- [ ] Investigate alerts and anomalies
- [ ] Document incident details
- [ ] Assess impact and severity
- [ ] Activate incident response team

### Containment & Recovery
- [ ] Isolate affected systems
- [ ] Preserve evidence for investigation
- [ ] Apply patches or mitigations
- [ ] Restore from clean backups
- [ ] Verify system integrity

### Post-Incident
- [ ] Conduct post-mortem analysis
- [ ] Update security controls
- [ ] Improve monitoring and detection
- [ ] Update incident response plan
- [ ] Communicate lessons learned

## Notes

- Review this checklist before EVERY production deployment
- Update checklist based on lessons learned
- Keep a copy of completed checklists for audit purposes
- Assign responsibility for each item
- Set deadlines for completion
- Regular security reviews are essential for maintaining a secure system
