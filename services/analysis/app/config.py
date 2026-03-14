from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://racing:racing@localhost:5432/racing_coach"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Object Storage (S3-compatible)
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket_uploads: str = "racing-coach-uploads"
    s3_bucket_generated: str = "racing-coach-generated"
    s3_region: str = "us-east-1"

    # Claude API
    anthropic_api_key: str = ""

    # TTS
    openai_api_key: str = ""

    # Analysis
    analysis_version: str = "0.1.0"

    class Config:
        env_file = "../../.env"


settings = Settings()
