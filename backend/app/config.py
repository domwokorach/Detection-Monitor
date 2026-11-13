"""Environment-backed app settings. All demo secrets must change in production."""
from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./fraud.db")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    jwt_secret: str = os.getenv("JWT_SECRET", "DEV_ONLY_CHANGE_ME_WITH_A_RANDOM_32_BYTE_SECRET")
    jwt_ttl_minutes: int = int(os.getenv("JWT_TTL_MINUTES", "480"))
    alert_threshold: int = int(os.getenv("ALERT_THRESHOLD", "40"))
    cors_origin: str = os.getenv("CORS_ORIGIN", "http://localhost:5173")
    notify_redis: bool = os.getenv("NOTIFY_REDIS", "1") == "1"
    # Investigation CSV export. Roles allowed to export; larger exports run as background jobs.
    export_roles: str = os.getenv("EXPORT_ROLES", "admin,analyst")
    export_async_threshold: int = int(os.getenv("EXPORT_ASYNC_THRESHOLD", "5000"))
    export_ttl_seconds: int = int(os.getenv("EXPORT_TTL_SECONDS", "900"))
    export_dir: str = os.getenv("EXPORT_DIR", "")
    # TrueLayer open-banking sandbox. The secret comes only from the environment.
    truelayer_client_id: str = os.getenv("TRUELAYER_CLIENT_ID", "")
    truelayer_client_secret: str = os.getenv("TRUELAYER_CLIENT_SECRET", "")
    truelayer_redirect_uri: str = os.getenv("TRUELAYER_REDIRECT_URI", "https://console.truelayer.com/redirect-page")
    truelayer_api_url: str = os.getenv("TRUELAYER_API_URL", "https://api.truelayer-sandbox.com")
    truelayer_auth_url: str = os.getenv("TRUELAYER_AUTH_URL", "https://auth.truelayer-sandbox.com")
    # Logo.dev brand search (server-side only). The secret key must never reach the browser.
    logo_dev_secret_key: str = os.getenv("LOGO_DEV_SECRET_KEY", "")
    logo_dev_api_url: str = os.getenv("LOGO_DEV_API_URL", "https://api.logo.dev")


settings = Settings()
