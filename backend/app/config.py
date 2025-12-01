from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    CLERK_SECRET_KEY: str = ""
    CLERK_WEBHOOK_SECRET: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    TITILER_URL: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
