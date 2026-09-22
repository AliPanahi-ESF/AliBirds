"""
Application configuration loaded from environment variables / .env file.
"""
from __future__ import annotations

from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ────────────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-me"
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    # ── Database ───────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./storage/alibirds.db"

    # ── Storage ────────────────────────────────────────────────────────────────
    STORAGE_PATH: Path = Path("./storage")
    PDF_OUTPUT_DIR: Path = Path("./storage/invoices")
    RECEIPT_UPLOAD_DIR: Path = Path("./storage/receipts")
    MT940_UPLOAD_DIR: Path = Path("./storage/mt940")

    # ── Email / SMTP ───────────────────────────────────────────────────────────
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SMTP_FROM_NAME: str = "AliBirds"
    SMTP_FROM_EMAIL: str = "noreply@example.com"
    SMTP_STARTTLS: bool = True

    # ── Scheduler ──────────────────────────────────────────────────────────────
    SCHEDULER_TIMEZONE: str = "Europe/Amsterdam"
    RECURRING_CRON_HOUR: int = 8
    RECURRING_CRON_MINUTE: int = 0

    def ensure_dirs(self) -> None:
        for d in (self.STORAGE_PATH, self.PDF_OUTPUT_DIR, self.RECEIPT_UPLOAD_DIR, self.MT940_UPLOAD_DIR):
            Path(d).mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
