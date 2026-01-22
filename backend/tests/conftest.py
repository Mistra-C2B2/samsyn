"""
Pytest configuration and shared fixtures.

Sets up PostgreSQL test database with proper cleanup.
"""

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings

# Test database URL - use separate test database if configured
TEST_DATABASE_URL = settings.TEST_DATABASE_URL or settings.DATABASE_URL


@pytest.fixture(scope="session")
def engine():
    """Create a test database engine."""
    engine = create_engine(
        TEST_DATABASE_URL,
        poolclass=StaticPool,  # Use single connection for testing
    )
    yield engine
    engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def clean_test_database(engine):
    """
    Clean the test database once before all tests run.

    This ensures a clean slate by removing any leftover data from previous runs.
    Individual tests use transaction rollback for isolation within the session.
    """
    session_factory = sessionmaker(bind=engine)
    session = session_factory()

    try:
        # Delete all data from tables (in correct order to avoid FK violations)
        session.execute(text("TRUNCATE TABLE map_layers CASCADE"))
        session.execute(text("TRUNCATE TABLE map_collaborators CASCADE"))
        session.execute(text("TRUNCATE TABLE layer_features CASCADE"))
        session.execute(text("TRUNCATE TABLE comments CASCADE"))
        session.execute(text("TRUNCATE TABLE maps CASCADE"))
        session.execute(text("TRUNCATE TABLE layers CASCADE"))
        session.execute(text("TRUNCATE TABLE users CASCADE"))
        session.commit()
    finally:
        session.close()

    yield


@pytest.fixture(scope="function")
def db_session(engine):
    """
    Create a new database session for a test.

    Uses a transaction that gets rolled back after each test,
    ensuring test isolation without recreating tables.
    """
    # Start a connection
    connection = engine.connect()

    # Begin a non-ORM transaction
    transaction = connection.begin()

    # Create session bound to the connection
    session_factory = sessionmaker(bind=connection)
    session = session_factory()

    yield session

    # Rollback transaction (undoes all changes made in the test)
    session.close()
    # Only rollback if transaction is still active
    if transaction.is_active:
        transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def clean_db(db_session):
    """
    Alternative fixture that completely cleans the database.

    Use this for integration tests that need a fresh database state.
    """
    # Delete all data from tables (in correct order to avoid FK violations)
    db_session.execute(text("TRUNCATE TABLE map_layers CASCADE"))
    db_session.execute(text("TRUNCATE TABLE map_collaborators CASCADE"))
    db_session.execute(text("TRUNCATE TABLE layer_features CASCADE"))
    db_session.execute(text("TRUNCATE TABLE comments CASCADE"))
    db_session.execute(text("TRUNCATE TABLE maps CASCADE"))
    db_session.execute(text("TRUNCATE TABLE layers CASCADE"))
    db_session.execute(text("TRUNCATE TABLE users CASCADE"))
    db_session.commit()

    yield db_session


# Configure pytest-asyncio
pytest_plugins = ("pytest_asyncio",)
