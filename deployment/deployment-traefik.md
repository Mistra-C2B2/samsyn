# Traefik Integration Guide

This guide explains how to integrate SamSyn with an existing Traefik reverse proxy for production deployment.

## Prerequisites

Before deploying SamSyn with Traefik, ensure you have:

- Traefik v2.x or v3.x installed and running
- Traefik configured with Let's Encrypt certificate resolver
- `traefik` Docker network created
- Traefik watching Docker socket (`/var/run/docker.sock`)
- DNS A record pointing to your server

## Traefik Configuration Requirements

### Minimum Traefik Setup

Your Traefik instance should have at least:

```yaml
# Example traefik docker-compose.yml
version: "3.8"

services:
  traefik:
    image: traefik:v2.10
    container_name: traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    networks:
      - traefik
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik.yml:/etc/traefik/traefik.yml:ro
      - ./acme.json:/acme.json
    labels:
      - "traefik.enable=true"
      # Dashboard (optional, secure with authentication)
      - "traefik.http.routers.dashboard.rule=Host(`traefik.yourdomain.com`)"
      - "traefik.http.routers.dashboard.service=api@internal"

networks:
  traefik:
    external: true
```

### Traefik Static Configuration

`traefik.yml`:
```yaml
api:
  dashboard: true

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https

  websecure:
    address: ":443"
    http:
      tls:
        certResolver: letsencrypt

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: traefik

certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@example.com
      storage: acme.json
      httpChallenge:
        entryPoint: web
```

## SamSyn Traefik Configuration

SamSyn uses Docker labels to configure Traefik routing. These labels are defined in `docker-compose.prod.yml`.

### Frontend Labels

The frontend service is configured with:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.samsyn-frontend.rule=Host(`${DOMAIN}`)"
  - "traefik.http.routers.samsyn-frontend.entrypoints=websecure"
  - "traefik.http.routers.samsyn-frontend.tls.certresolver=letsencrypt"
  - "traefik.http.services.samsyn-frontend.loadbalancer.server.port=80"
  - "traefik.http.routers.samsyn-frontend.priority=1"
  - "traefik.docker.network=traefik"
```

**Explanation:**
- `traefik.enable=true` - Enable Traefik for this container
- `rule=Host(...)` - Match all requests to your domain
- `entrypoints=websecure` - Use HTTPS (port 443)
- `tls.certresolver=letsencrypt` - Use Let's Encrypt for SSL
- `loadbalancer.server.port=80` - Container listens on port 80
- `priority=1` - Lower priority (backend has higher priority)
- `docker.network=traefik` - Use traefik network for routing

### Backend Labels

The backend service is configured with:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.samsyn-backend.rule=Host(`${DOMAIN}`) && (PathPrefix(`/api`) || PathPrefix(`/docs`) || PathPrefix(`/redoc`))"
  - "traefik.http.routers.samsyn-backend.entrypoints=websecure"
  - "traefik.http.routers.samsyn-backend.tls.certresolver=letsencrypt"
  - "traefik.http.services.samsyn-backend.loadbalancer.server.port=8000"
  - "traefik.docker.network=traefik"
```

**Explanation:**
- `rule=Host(...) && (PathPrefix(...))` - Match domain + specific paths
- Routes `/api/*`, `/docs`, and `/redoc` to backend
- Default priority (higher than frontend's priority=1)
- Container listens on port 8000

### Routing Logic

With this configuration:

1. **Frontend Routes** (priority 1):
   - `https://samsyn.yourdomain.com/` → Frontend
   - `https://samsyn.yourdomain.com/maps` → Frontend
   - `https://samsyn.yourdomain.com/admin` → Frontend
   - Any path not matching backend rules → Frontend (SPA routing)

2. **Backend Routes** (default priority):
   - `https://samsyn.yourdomain.com/api/v1/maps` → Backend
   - `https://samsyn.yourdomain.com/docs` → Backend (Swagger UI)
   - `https://samsyn.yourdomain.com/redoc` → Backend (ReDoc)
   - Any path starting with `/api/` → Backend

## Network Configuration

SamSyn uses a dual-network setup:

### Internal Network (samsyn-network)

For internal service communication:
- Database (db)
- TiTiler
- Backend
- Frontend
- Backup service

```yaml
networks:
  samsyn-network:
    driver: bridge
```

### External Network (traefik)

For Traefik routing:
- Backend (needs to be accessible via Traefik)
- Frontend (needs to be accessible via Traefik)

```yaml
networks:
  traefik:
    external: true  # Must already exist
```

**Important:** The `traefik` network must be created before deploying SamSyn:

```bash
docker network create traefik
```

## Middleware Configuration (Optional)

Enhance security and performance with Traefik middleware.

### Rate Limiting

Add to backend service in `docker-compose.prod.yml`:

```yaml
labels:
  # ... existing labels ...
  - "traefik.http.middlewares.samsyn-ratelimit.ratelimit.average=100"
  - "traefik.http.middlewares.samsyn-ratelimit.ratelimit.burst=50"
  - "traefik.http.middlewares.samsyn-ratelimit.ratelimit.period=1s"
  - "traefik.http.routers.samsyn-backend.middlewares=samsyn-ratelimit"
```

**Configuration:**
- `average=100` - Average 100 requests per period
- `burst=50` - Allow bursts of up to 50 additional requests
- `period=1s` - Time period (1 second)

### Security Headers

Add to both frontend and backend services:

```yaml
labels:
  # ... existing labels ...
  - "traefik.http.middlewares.samsyn-headers.headers.sslredirect=true"
  - "traefik.http.middlewares.samsyn-headers.headers.stsSeconds=31536000"
  - "traefik.http.middlewares.samsyn-headers.headers.stsIncludeSubdomains=true"
  - "traefik.http.middlewares.samsyn-headers.headers.stsPreload=true"
  - "traefik.http.middlewares.samsyn-headers.headers.frameDeny=true"
  - "traefik.http.middlewares.samsyn-headers.headers.contentTypeNosniff=true"
  - "traefik.http.middlewares.samsyn-headers.headers.browserXssFilter=true"
  - "traefik.http.middlewares.samsyn-headers.headers.referrerPolicy=strict-origin-when-cross-origin"
  - "traefik.http.routers.samsyn-frontend.middlewares=samsyn-headers"
```

**Security headers:**
- HSTS (Strict-Transport-Security)
- X-Frame-Options (clickjacking protection)
- X-Content-Type-Options (MIME type sniffing protection)
- X-XSS-Protection (XSS filter)
- Referrer-Policy

### Compression

Add to frontend service for better performance:

```yaml
labels:
  # ... existing labels ...
  - "traefik.http.middlewares.samsyn-compress.compress=true"
  - "traefik.http.routers.samsyn-frontend.middlewares=samsyn-compress,samsyn-headers"
```

### Chaining Middleware

To use multiple middleware together, chain them:

```yaml
- "traefik.http.routers.samsyn-frontend.middlewares=samsyn-compress,samsyn-headers"
- "traefik.http.routers.samsyn-backend.middlewares=samsyn-ratelimit,samsyn-headers"
```

## Deployment Steps

### 1. Verify Traefik is Running

```bash
# Check Traefik container
docker ps | grep traefik

# Check Traefik logs
docker logs traefik
```

### 2. Verify Traefik Network Exists

```bash
# List networks
docker network ls | grep traefik

# If not exists, create it
docker network create traefik
```

### 3. Deploy SamSyn

```bash
cd /opt/samsyn

# Configure environment
cp .env.prod.example .env.prod
nano .env.prod
# Set DOMAIN=samsyn.yourdomain.com

# Build and start services
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

### 4. Verify Traefik Discovery

```bash
# Check Traefik logs for SamSyn routes
docker logs traefik 2>&1 | grep samsyn

# Expected output:
# - Registering samsyn-frontend router
# - Registering samsyn-backend router
```

### 5. Test Routing

```bash
# Test frontend
curl -I https://samsyn.yourdomain.com/

# Test backend
curl -I https://samsyn.yourdomain.com/api/health

# Test Swagger
curl -I https://samsyn.yourdomain.com/docs
```

## Monitoring Traefik

### Traefik Dashboard

If you have the Traefik dashboard enabled, visit it to verify:

1. **Routers:**
   - `samsyn-frontend@docker`
     - Rule: `Host(samsyn.yourdomain.com)`
     - Service: samsyn-frontend
     - TLS: Yes
   - `samsyn-backend@docker`
     - Rule: `Host(samsyn.yourdomain.com) && (PathPrefix(/api) || PathPrefix(/docs) || PathPrefix(/redoc))`
     - Service: samsyn-backend
     - TLS: Yes

2. **Services:**
   - `samsyn-frontend@docker`
     - Server: samsyn-frontend-prod:80
     - Status: UP
   - `samsyn-backend@docker`
     - Server: samsyn-backend-prod:8000
     - Status: UP

3. **Middlewares:**
   - `samsyn-ratelimit@docker` (if configured)
   - `samsyn-headers@docker` (if configured)
   - `samsyn-compress@docker` (if configured)

### Traefik Logs

```bash
# View all Traefik logs
docker logs traefik

# Follow Traefik logs in real-time
docker logs -f traefik

# Filter for SamSyn-related logs
docker logs traefik 2>&1 | grep samsyn

# Check for errors
docker logs traefik 2>&1 | grep -i error
```

## Troubleshooting

### Services Not Accessible

**Problem:** Can't access SamSyn via domain

**Diagnosis:**
```bash
# 1. Check if containers are on traefik network
docker network inspect traefik | grep samsyn

# 2. Check Traefik logs
docker logs traefik | grep samsyn

# 3. Verify labels are applied
docker inspect samsyn-frontend-prod | grep -A 10 Labels
docker inspect samsyn-backend-prod | grep -A 10 Labels
```

**Solutions:**
- Ensure `traefik` network exists: `docker network create traefik`
- Restart SamSyn services: `docker compose -f docker-compose.prod.yml restart`
- Check Traefik is watching Docker: `docker inspect traefik | grep docker.sock`

### SSL Certificate Not Issued

**Problem:** HTTPS not working, certificate errors

**Diagnosis:**
```bash
# Check Traefik certificate logs
docker logs traefik | grep -i certificate

# Check DNS
dig samsyn.yourdomain.com

# Test ACME challenge
curl http://samsyn.yourdomain.com/.well-known/acme-challenge/test
```

**Solutions:**
- Verify DNS A record points to server IP
- Wait 2-5 minutes for Let's Encrypt validation
- Check Traefik's `acme.json` file: `ls -la acme.json`
- Ensure ports 80 and 443 are accessible from internet
- Check Traefik certificate resolver configuration

### Frontend Shows 404 for API Calls

**Problem:** Frontend loads but API calls fail

**Diagnosis:**
```bash
# Test backend directly
curl https://samsyn.yourdomain.com/api/health

# Check backend logs
docker compose -f docker-compose.prod.yml logs backend

# Verify routing in Traefik
docker logs traefik | grep samsyn-backend
```

**Solutions:**
- Verify `VITE_API_URL` in `.env.prod` is correct
- Rebuild frontend if environment variable changed:
  ```bash
  docker compose -f docker-compose.prod.yml build frontend
  docker compose -f docker-compose.prod.yml up -d frontend
  ```
- Check Traefik routing priority (backend should match before frontend)

### Route Priority Issues

**Problem:** Backend routes being caught by frontend

**Solution:**
Backend routes use default priority (which is higher than frontend's `priority=1`). If issues persist, explicitly set backend priority:

```yaml
labels:
  # ... existing labels ...
  - "traefik.http.routers.samsyn-backend.priority=10"
```

Higher numbers = higher priority.

### Traefik Can't See Containers

**Problem:** Routes not appearing in Traefik

**Diagnosis:**
```bash
# Check Traefik provider configuration
docker logs traefik | grep -i docker

# Check if docker.sock is mounted
docker inspect traefik | grep docker.sock
```

**Solutions:**
- Ensure Traefik has Docker socket mounted:
  ```yaml
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
  ```
- Verify `exposedByDefault: false` in Traefik config
- Check `traefik.enable=true` label is set on containers

## Advanced Configuration

### Custom Certificate

To use a custom SSL certificate instead of Let's Encrypt:

```yaml
labels:
  # Remove TLS cert resolver
  # - "traefik.http.routers.samsyn-frontend.tls.certresolver=letsencrypt"

  # Add custom certificate
  - "traefik.http.routers.samsyn-frontend.tls.domains[0].main=samsyn.yourdomain.com"
```

Then mount certificates in Traefik:
```yaml
volumes:
  - ./certs:/certs:ro
```

### IP Whitelisting

Restrict access to specific IPs (e.g., for admin panel):

```yaml
labels:
  - "traefik.http.middlewares.samsyn-ipwhitelist.ipwhitelist.sourcerange=1.2.3.4/32,5.6.7.8/32"
  - "traefik.http.routers.samsyn-backend.middlewares=samsyn-ipwhitelist"
```

### Basic Authentication

Add basic auth to Swagger/ReDoc:

```bash
# Generate password hash
htpasswd -nb admin your-password
# Output: admin:$apr1$xyz123$...

# Add to labels
labels:
  - "traefik.http.middlewares.samsyn-auth.basicauth.users=admin:$$apr1$$xyz123$$..."
  # Note: Escape $ with $$ in docker-compose
  - "traefik.http.routers.samsyn-backend.middlewares=samsyn-auth"
```

## Best Practices

1. **Use Environment Variables:** Set `DOMAIN` in `.env.prod` for easy updates
2. **Monitor Traefik Logs:** Regularly check for errors and warnings
3. **Enable Access Logs:** Configure Traefik to log all requests
4. **Use Middleware:** Add rate limiting, security headers, and compression
5. **Test Certificate Renewal:** Verify Let's Encrypt auto-renewal works
6. **Keep Traefik Updated:** Regularly update Traefik for security patches
7. **Backup acme.json:** Include Traefik's `acme.json` in backups
8. **Use HTTPS Only:** Configure HTTP → HTTPS redirect in Traefik
9. **Secure Dashboard:** If enabling Traefik dashboard, protect with authentication
10. **Monitor Metrics:** Export Traefik metrics to Prometheus for monitoring

## References

- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [Traefik Docker Provider](https://doc.traefik.io/traefik/providers/docker/)
- [Traefik Middleware](https://doc.traefik.io/traefik/middlewares/overview/)
- [Let's Encrypt with Traefik](https://doc.traefik.io/traefik/user-guides/docker-compose/acme-http/)
