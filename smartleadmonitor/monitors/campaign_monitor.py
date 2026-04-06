import logging
from dataclasses import dataclass, field
from datetime import datetime

from ..api_client import SmartLeadClient

logger = logging.getLogger(__name__)


@dataclass
class CampaignSnapshot:
    campaign_id: int
    name: str
    status: str
    total_leads: int = 0
    sent: int = 0
    opened: int = 0
    clicked: int = 0
    replied: int = 0
    bounced: int = 0
    unsubscribed: int = 0
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


class CampaignMonitor:
    """Monitors all campaigns and tracks analytics changes."""

    def __init__(self, client: SmartLeadClient):
        self.client = client
        self._previous_snapshots: dict[int, CampaignSnapshot] = {}

    def get_all_snapshots(self) -> list[CampaignSnapshot]:
        campaigns = self.client.list_campaigns()
        snapshots = []

        for campaign in campaigns:
            cid = campaign.get("id")
            name = campaign.get("name", "Unknown")
            status = campaign.get("status", "unknown")

            try:
                analytics = self.client.get_campaign_analytics(cid)
            except Exception:
                logger.warning("Failed to get analytics for campaign %s (%s)", cid, name)
                analytics = {}

            snapshot = CampaignSnapshot(
                campaign_id=cid,
                name=name,
                status=status,
                total_leads=analytics.get("total_leads", 0),
                sent=analytics.get("sent", 0),
                opened=analytics.get("opened", 0),
                clicked=analytics.get("clicked", 0),
                replied=analytics.get("replied", 0),
                bounced=analytics.get("bounced", 0),
                unsubscribed=analytics.get("unsubscribed", 0),
            )
            snapshots.append(snapshot)

        return snapshots

    def check(self) -> list[dict]:
        """Run a monitoring check and return a list of change events."""
        snapshots = self.get_all_snapshots()
        events = []

        for snap in snapshots:
            prev = self._previous_snapshots.get(snap.campaign_id)

            if prev is None:
                events.append({
                    "type": "campaign_discovered",
                    "campaign_id": snap.campaign_id,
                    "name": snap.name,
                    "status": snap.status,
                    "snapshot": snap,
                })
            else:
                changes = {}
                for attr in ("sent", "opened", "clicked", "replied", "bounced", "unsubscribed"):
                    old_val = getattr(prev, attr)
                    new_val = getattr(snap, attr)
                    if new_val != old_val:
                        changes[attr] = {"old": old_val, "new": new_val, "delta": new_val - old_val}

                if prev.status != snap.status:
                    events.append({
                        "type": "campaign_status_changed",
                        "campaign_id": snap.campaign_id,
                        "name": snap.name,
                        "old_status": prev.status,
                        "new_status": snap.status,
                    })

                if changes:
                    events.append({
                        "type": "campaign_metrics_changed",
                        "campaign_id": snap.campaign_id,
                        "name": snap.name,
                        "changes": changes,
                        "snapshot": snap,
                    })

            self._previous_snapshots[snap.campaign_id] = snap

        logger.info("Campaign check complete: %d campaigns, %d events", len(snapshots), len(events))
        return events
