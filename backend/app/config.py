from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    cors_origins: str = "http://localhost:5173"

    # Added Week 2 — Supabase connection
    database_url: str = ""
    max_upload_size_mb: int = 20

    class Config:
        env_file = ".env"


settings = Settings()
