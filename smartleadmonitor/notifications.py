import json
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import requests

from .config import Config

logger = logging.getLogger(__name__)


def send_email(subject: str, body_html: str, body_text: str | None = None):
    """Send an email notification."""
    if not Config.SMTP_HOST or not Config.NOTIFY_EMAIL:
        logger.debug("Email notifications not configured, skipping")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = Config.SMTP_USER
    msg["To"] = Config.NOTIFY_EMAIL

    if body_text:
        msg.attach(MIMEText(body_text, "plain"))
    msg.attach(MIMEText(body_html, "html"))

    try:
        with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT) as server:
            server.starttls()
            server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
            server.sendmail(Config.SMTP_USER, Config.NOTIFY_EMAIL, msg.as_string())
        logger.info("Email sent: %s", subject)
    except Exception:
        logger.error("Failed to send email: %s", subject, exc_info=True)


def send_slack(text: str, blocks: list[dict] | None = None):
    """Send a Slack notification via webhook."""
    if not Config.SLACK_WEBHOOK_URL:
        logger.debug("Slack notifications not configured, skipping")
        return

    payload = {"text": text}
    if blocks:
        payload["blocks"] = blocks

    try:
        resp = requests.post(Config.SLACK_WEBHOOK_URL, json=payload, timeout=10)
        resp.raise_for_status()
        logger.info("Slack notification sent")
    except Exception:
        logger.error("Failed to send Slack notification", exc_info=True)


def notify(subject: str, body_html: str, body_text: str | None = None, slack_text: str | None = None):
    """Send notification via all configured channels."""
    send_email(subject, body_html, body_text)
    if slack_text:
        send_slack(slack_text)
