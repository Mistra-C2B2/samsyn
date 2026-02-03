from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    TEST_DATABASE_URL: str = (
        ""  # Separate test database (optional, defaults to DATABASE_URL)
    )
    CLERK_SECRET_KEY: str = ""
    CLERK_WEBHOOK_SECRET: str = ""
    CLERK_JWKS_URL: str = ""  # Clerk JWKS endpoint (e.g., "https://your-app-12.clerk.accounts.dev/.well-known/jwks.json")
    FRONTEND_URL: str = "http://localhost:3000"
    TITILER_URL: str = ""
    GFW_API_TOKEN: str = ""  # Global Fishing Watch API token (server-side only)
    DEV_MODE: bool = True  # Enable dev-only features like WMS proxy

    # Database Connection Pool Settings
    DB_POOL_SIZE: int = 20  # Base number of persistent connections
    DB_MAX_OVERFLOW: int = 30  # Additional connections during spikes
    DB_POOL_RECYCLE: int = 3600  # Recycle connections after N seconds
    DB_POOL_TIMEOUT: int = 60  # Wait N seconds for connection before timing out

    # HTTP Client Connection Pool Settings
    HTTP_POOL_CONNECTIONS: int = 100  # Max connections in pool
    HTTP_POOL_MAXSIZE: int = 100  # Max connections per host
    HTTP_TIMEOUT: float = 30.0  # Default timeout in seconds
    HTTP_KEEPALIVE_EXPIRY: float = 30.0  # Keep connections alive for N seconds

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
