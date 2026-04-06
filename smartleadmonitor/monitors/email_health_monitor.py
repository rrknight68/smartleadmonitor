import logging
from dataclasses import dataclass, field
from datetime import datetime

from ..api_client import SmartLeadClient

logger = logging.getLogger(__name__)

HEALTHY_THRESHOLD = 0.95
WARNING_THRESHOLD = 0.85


@dataclass
class EmailAccountHealth:
    account_id: int
    email: str
    warmup_enabled: bool = False
    warmup_reputation: float = 0.0
    total_sent: int = 0
    total_bounced: int = 0
    bounce_rate: float = 0.0
    health_status: str = "unknown"  # healthy, warning, critical
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


class EmailHealthMonitor:
    """Monitors email account health and warmup status."""

    def __init__(self, client: SmartLeadClient):
        self.client = client
        self._previous_health: dict[int, EmailAccountHealth] = {}

    def _assess_health(self, account: dict) -> EmailAccountHealth:
        account_id = account.get("id", 0)
        email = account.get("from_email", account.get("email", "unknown"))
        warmup_enabled = account.get("warmup_enabled", False)
        warmup_reputation = account.get("warmup_reputation", 0.0)

        # Parse sending stats
        total_sent = account.get("total_sent", 0)
        total_bounced = account.get("total_bounced", 0)
        bounce_rate = (total_bounced / total_sent * 100) if total_sent > 0 else 0.0

        # Determine health status
        if total_sent == 0:
            health_status = "new"
        elif bounce_rate > 10:
            health_status = "critical"
        elif bounce_rate > 5:
            health_status = "warning"
        elif warmup_reputation and warmup_reputation < WARNING_THRESHOLD:
            health_status = "warning"
        else:
            health_status = "healthy"

        return EmailAccountHealth(
            account_id=account_id,
            email=email,
            warmup_enabled=warmup_enabled,
            warmup_reputation=warmup_reputation,
            total_sent=total_sent,
            total_bounced=total_bounced,
            bounce_rate=bounce_rate,
            health_status=health_status,
        )

    def check(self) -> list[dict]:
        """Check health of all email accounts."""
        accounts = self.client.list_email_accounts()
        events = []

        for account in accounts:
            health = self._assess_health(account)
            prev = self._previous_health.get(health.account_id)

            if prev is None:
                events.append({
                    "type": "email_health_report",
                    "account_id": health.account_id,
                    "email": health.email,
                    "health_status": health.health_status,
                    "bounce_rate": health.bounce_rate,
                    "warmup_enabled": health.warmup_enabled,
                    "warmup_reputation": health.warmup_reputation,
                })
            elif prev.health_status != health.health_status:
                events.append({
                    "type": "email_health_changed",
                    "account_id": health.account_id,
                    "email": health.email,
                    "old_status": prev.health_status,
                    "new_status": health.health_status,
                    "bounce_rate": health.bounce_rate,
                    "warmup_reputation": health.warmup_reputation,
                })

                if health.health_status == "critical":
                    logger.warning("CRITICAL: Email account %s bounce rate at %.1f%%",
                                   health.email, health.bounce_rate)

            self._previous_health[health.account_id] = health

        logger.info("Email health check complete: %d accounts", len(accounts))
        return events

    def get_all_health(self) -> list[EmailAccountHealth]:
        """Get current health status for all email accounts."""
        accounts = self.client.list_email_accounts()
        return [self._assess_health(a) for a in accounts]
