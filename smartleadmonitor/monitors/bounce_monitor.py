import logging

from ..api_client import SmartLeadClient
from ..config import Config

logger = logging.getLogger(__name__)

BOUNCE_STATUSES = {"bounced", "BOUNCED", "Bounced"}


class BounceMonitor:
    """Detects bounced leads and optionally auto-deletes them."""

    def __init__(self, client: SmartLeadClient, auto_delete: bool | None = None):
        self.client = client
        self.auto_delete = auto_delete if auto_delete is not None else Config.BOUNCE_AUTO_DELETE
        self._processed_leads: set[tuple[int, int]] = set()

    def check(self) -> list[dict]:
        """Scan all campaigns for bounced leads. Returns list of bounce events."""
        campaigns = self.client.list_campaigns()
        events = []

        for campaign in campaigns:
            cid = campaign.get("id")
            name = campaign.get("name", "Unknown")

            try:
                leads = self.client.get_all_campaign_leads(cid)
            except Exception:
                logger.warning("Failed to fetch leads for campaign %s (%s)", cid, name)
                continue

            for lead in leads:
                lead_id = lead.get("id")
                lead_email = lead.get("email", "unknown")
                lead_status = lead.get("lead_status", lead.get("status", ""))
                key = (cid, lead_id)

                if lead_status in BOUNCE_STATUSES and key not in self._processed_leads:
                    event = {
                        "type": "bounce_detected",
                        "campaign_id": cid,
                        "campaign_name": name,
                        "lead_id": lead_id,
                        "email": lead_email,
                        "deleted": False,
                    }

                    if self.auto_delete:
                        try:
                            self.client.delete_lead(cid, lead_id)
                            event["deleted"] = True
                            logger.info("Auto-deleted bounced lead %s from campaign %s",
                                        lead_email, name)
                        except Exception:
                            logger.error("Failed to delete bounced lead %s (id=%s) from campaign %s",
                                         lead_email, lead_id, name)
                    else:
                        logger.info("Bounced lead detected: %s in campaign %s (auto-delete OFF)",
                                    lead_email, name)

                    events.append(event)
                    self._processed_leads.add(key)

        logger.info("Bounce check complete: %d new bounces found", len(events))
        return events
