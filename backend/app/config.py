from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    cors_origins: str = "http://localhost:5173"
    database_url: str = ""
    max_upload_size_mb: int = 20
    openai_api_key: str = ""
    jwt_secret: str = ""
    jwt_expire_minutes: int = 60

    class Config:
        env_file = ".env"


settings = Settings()
