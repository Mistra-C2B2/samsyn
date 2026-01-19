from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    TEST_DATABASE_URL: str = ""  # Separate test database (optional, defaults to DATABASE_URL)
    CLERK_SECRET_KEY: str = ""
    CLERK_WEBHOOK_SECRET: str = ""
    CLERK_JWKS_URL: str = ""  # Clerk JWKS endpoint (e.g., "https://your-app-12.clerk.accounts.dev/.well-known/jwks.json")
    FRONTEND_URL: str = "http://localhost:3000"
    TITILER_URL: str = ""
    DEV_MODE: bool = True  # Enable dev-only features like WMS proxy

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
