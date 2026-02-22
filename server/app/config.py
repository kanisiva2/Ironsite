from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Firebase
    firebase_service_account_path: str = "serviceAccountKey.json"
    firebase_storage_bucket: str = ""

    # Gemini (also used for Nano Banana image generation)
    gemini_api_key: str = ""
    gemini_image_model: str = "nano-banana-pro-preview"

    # World Labs
    worldlabs_api_key: str = ""
    worldlabs_model: str = "Marble 0.1-plus"
    worldlabs_poll_interval_seconds: int = 10
    worldlabs_max_poll_attempts: int = 180
    worldlabs_max_poll_attempts_mini: int = 120

    # App
    cors_origins: str = "http://localhost:5173"
    log_level: str = "INFO"


settings = Settings()
