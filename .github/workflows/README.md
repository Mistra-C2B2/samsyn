# GitHub Actions Workflows

This directory contains CI/CD workflows for automated testing and validation.

## Workflows

### 1. test.yml - Code Quality and Unit Tests
**Triggers:** Push to main/new-frontend, Pull Requests, Manual
**Purpose:** Run code tests, linting, and security scans

**Jobs:**
- **test-backend**: Runs Python backend tests with pytest
- **test-frontend**: Runs Biome linting and format checks on React frontend
- **gitleaks**: Scans for secrets and credentials in code
- **test-summary**: Reports overall test results

**Status Badge:**
```markdown
![Tests](https://github.com/YOUR_ORG/YOUR_REPO/workflows/Run%20Tests/badge.svg)
```

---

### 2. docker-build.yml - Container Build Validation
**Triggers:** Push to main/develop, Pull Requests, Manual
**Purpose:** Ensure Docker containers build and start correctly

**Jobs:**

#### test-backend-build
- Builds backend Docker image using BuildKit cache
- Starts PostgreSQL container for testing
- Starts backend container with database connection
- Verifies backend starts without errors
- Tests container networking and database connectivity

#### test-frontend-build
- Validates nginx template contains DOMAIN placeholders
- Builds frontend Docker image with Vite build
- Starts frontend container with test DOMAIN
- Tests health endpoint responds correctly
- Verifies Content-Security-Policy headers are present
- Validates DOMAIN variable substitution works

#### test-docker-compose
- Creates test environment file with dummy values
- Builds all services using `docker-compose.prod.yml`
- Verifies all service images were created
- Tests parallel build capability

#### build-summary
- Reports status of all Docker build tests
- Fails if any build test fails

**Status Badge:**
```markdown
![Docker Build](https://github.com/YOUR_ORG/YOUR_REPO/workflows/Docker%20Build%20Tests/badge.svg)
```

---

## Running Workflows Locally

### Test Code Quality Locally
```bash
# Backend tests
cd backend
uv run pytest tests/ -v

# Frontend linting
cd frontend
npm run lint
npm run format
```

### Test Docker Builds Locally
```bash
# Build backend
docker build -t samsyn-backend:test ./backend

# Build frontend
docker build -t samsyn-frontend:test \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_test_dummy \
  --build-arg VITE_API_URL=http://localhost:8000 \
  ./frontend

# Build all with docker compose
docker compose -f docker-compose.prod.yml build
```

### Verify Production Deployment
After deploying to production, verify the configuration:

```bash
# Check CSP headers are present
curl -I https://your-domain.com | grep -i content-security-policy

# Verify nginx config has correct domain (not ${DOMAIN} placeholder)
docker exec samsyn-frontend-prod cat /etc/nginx/nginx.conf | grep -E "clerk\.|api\."

# Check health endpoint
curl https://your-domain.com/health
```

---

## Workflow Configuration

### Required Secrets
- `GITLEAKS_LICENSE` (optional) - Gitleaks Pro license for advanced scanning

### Cache Optimization
Both workflows use GitHub Actions cache:
- **test.yml**: Caches npm packages for faster frontend builds
- **docker-build.yml**: Uses Docker BuildKit cache (gha) for layer caching

---

## Troubleshooting

### Workflow Fails: "Backend container failed to start"
**Cause:** Backend can't connect to database or missing environment variables
**Fix:** Check backend logs in GitHub Actions output, verify Dockerfile CMD

### Workflow Fails: "CSP headers missing"
**Cause:** nginx template substitution failed or entrypoint not running
**Fix:** Verify `frontend/entrypoint.sh` is executable and DOMAIN env is passed

### Workflow Fails: "Some services failed to build"
**Cause:** Docker build error in backend or frontend
**Fix:** Check build logs for specific errors, test locally first

### Cache Issues
If builds are slow or failing due to cache:
```bash
# Manually trigger workflow with workflow_dispatch to rebuild cache
# Or clear cache in GitHub Settings > Actions > Caches
```

---

## Adding New Workflows

When adding new workflows:
1. Create `.github/workflows/your-workflow.yml`
2. Use descriptive job and step names
3. Add summary job that reports status
4. Update this README with workflow documentation
5. Test workflow locally with `act` if possible

---

## Related Files

- `docker-compose.prod.yml` - Production Docker configuration
- `frontend/nginx.conf.template` - Nginx configuration template
- `frontend/entrypoint.sh` - Container startup script
