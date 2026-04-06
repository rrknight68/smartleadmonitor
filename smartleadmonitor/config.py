import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SMARTLEAD_API_KEY = os.getenv("SMARTLEAD_API_KEY", "")
    BASE_URL = "https://server.smartlead.ai/api/v1"

    CHECK_INTERVAL_MINUTES = int(os.getenv("CHECK_INTERVAL_MINUTES", "30"))
    BOUNCE_AUTO_DELETE = os.getenv("BOUNCE_AUTO_DELETE", "true").lower() == "true"

    # Email notifications
    SMTP_HOST = os.getenv("SMTP_HOST", "")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    NOTIFY_EMAIL = os.getenv("NOTIFY_EMAIL", "")

    # Slack
    SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")

    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

    @classmethod
    def validate(cls):
        if not cls.SMARTLEAD_API_KEY:
            raise ValueError("SMARTLEAD_API_KEY is required. Set it in your .env file.")
