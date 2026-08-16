from pydantic import field_validator
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://dmart_user:dmart_pass@localhost:5432/dmart_db"
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET: str = "CHANGE_ME_TO_A_RANDOM_64_CHAR_SECRET"
    JWT_EXPIRY_HOURS: int = 24
    ANTHROPIC_API_KEY: str = ""
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:8080"
    FRONTEND_URL: str = "http://localhost:8080"

    # SMTP configuration
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@dmart.com"

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not (v.startswith("postgresql://") or v.startswith("postgresql+psycopg2://")):
            raise ValueError(
                "DATABASE_URL must be a PostgreSQL connection string starting with 'postgresql://' or 'postgresql+psycopg2://'"
            )
        return v

    @field_validator("CORS_ORIGINS")
    @classmethod
    def validate_cors_origins(cls, v: str) -> str:
        origins = [origin.strip() for origin in v.split(",") if origin.strip()]
        if "*" in origins:
            raise ValueError("CORS_ORIGINS cannot contain the wildcard '*' for security reasons.")
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
