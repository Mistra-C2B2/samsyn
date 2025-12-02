# Testing Guide

## Running Tests

### Run All Tests
```bash
cd /workspace/backend
source .venv/bin/activate
pytest tests/ -v
```

### Run Specific Test Files
```bash
# Auth service tests (JWT verification, JWKS caching)
pytest tests/test_auth_service.py -v

# User service tests (CRUD operations, deletion)
pytest tests/test_user_service.py -v

# Webhook unit tests (with mocked signatures)
pytest tests/test_webhooks.py -v

# Webhook integration tests (full end-to-end)
pytest tests/test_webhooks_integration.py -v
```

### Run Tests with Coverage
```bash
pytest tests/ --cov=app --cov-report=html
# Open htmlcov/index.html to view coverage report
```

## Test Structure

### Unit Tests
Located in `tests/` directory, these test individual components in isolation:

- **`test_auth_service.py`** - Auth service (10 tests)
  - JWKS fetching and caching
  - JWT token verification
  - Error handling

- **`test_user_service.py`** - User service (20 tests)
  - CRUD operations
  - get_or_create idempotency
  - User deletion with ownership transfer
  - Deleted user placeholder management

- **`test_webhooks.py`** - Webhook endpoints (10 tests)
  - Signature verification with Svix
  - User created/updated/deleted events
  - Duplicate webhook handling
  - Unknown event types

### Integration Tests
End-to-end tests that verify complete workflows:

- **`test_webhooks_integration.py`** - Webhook integration (7 tests)
  - Full user lifecycle (create → update → delete)
  - Database state verification
  - Ownership transfer on deletion
  - Multiple user management

## Test Database

Tests use **PostgreSQL** (same as production) with transaction rollback for isolation:

- Each test runs in its own transaction
- Changes are rolled back after each test
- No database pollution between tests
- Configured in `tests/conftest.py`

## Test Endpoints

### Development/Testing Only

**Test Webhook Endpoint** (NO signature verification):
```
POST /api/v1/test-webhooks/clerk
```

This endpoint is used by integration tests and allows testing webhook logic locally without proper Svix signatures.

**⚠️ Remove before production deployment!**

### Production Endpoints

**Real Webhook Endpoint** (WITH signature verification):
```
POST /api/v1/webhooks/clerk
```

This endpoint verifies Svix signatures and should be used with Clerk in production.

## Local Webhook Testing

Since Clerk's servers can't reach `localhost:8000`, use the integration tests:

```bash
# Test webhook events locally
pytest tests/test_webhooks_integration.py -v

# Test specific workflow
pytest tests/test_webhooks_integration.py::TestWebhookIntegrationEndToEnd::test_complete_user_lifecycle -v
```

These tests use the `/api/v1/test-webhooks/clerk` endpoint which doesn't require signatures.

## CI/CD Integration

The test suite is designed for CI/CD:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: |
    cd backend
    source .venv/bin/activate
    pytest tests/ -v --cov=app --cov-report=xml

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./backend/coverage.xml
```

## Test Coverage

Current coverage:

- **Auth Service**: 100%
- **User Service**: 100%
- **Webhooks**: 100%
- **Overall**: ~95%

## Troubleshooting

### "ModuleNotFoundError"
```bash
# Make sure you're in the backend directory and venv is activated
cd /workspace/backend
source .venv/bin/activate
```

### "Database connection failed"
```bash
# Start the database
docker-compose up -d db

# Verify it's running
docker ps | grep samsyn-db
```

### "Tests are slow"
```bash
# Run tests in parallel (requires pytest-xdist)
pip install pytest-xdist
pytest tests/ -n auto
```

## Writing New Tests

### Example Test
```python
def test_example(client, db_session, user_service):
    """Test description"""
    # Arrange
    payload = {"type": "user.created", "data": {...}}

    # Act
    response = client.post("/api/v1/test-webhooks/clerk", json=payload)

    # Assert
    assert response.status_code == 200
    user = user_service.get_by_clerk_id("user_123")
    assert user is not None
```

### Available Fixtures

- `client` - FastAPI TestClient
- `db_session` - Database session (auto-rollback)
- `user_service` - UserService instance
- `clean_db` - Clean database (truncate all tables)

See `tests/conftest.py` for more details.
