import logging

from ..api_client import SmartLeadClient

logger = logging.getLogger(__name__)

POSITIVE_STATUSES = {"Interested", "interested", "INTERESTED"}
REPLY_STATUSES = {"replied", "Replied", "REPLIED"}


class ResponseMonitor:
    """Monitors for positive responses across campaigns."""

    def __init__(self, client: SmartLeadClient):
        self.client = client
        self._seen_replies: set[tuple[int, int]] = set()

    def check(self) -> list[dict]:
        """Scan all campaigns for new positive responses."""
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

                if key in self._seen_replies:
                    continue

                is_positive = lead_status in POSITIVE_STATUSES
                is_reply = lead_status in REPLY_STATUSES

                if is_positive or is_reply:
                    event = {
                        "type": "positive_response" if is_positive else "reply_detected",
                        "campaign_id": cid,
                        "campaign_name": name,
                        "lead_id": lead_id,
                        "email": lead_email,
                        "status": lead_status,
                    }

                    # Try to get message history for context
                    try:
                        messages = self.client.get_message_history(cid, lead_id)
                        if messages:
                            last_msg = messages[-1]
                            event["last_message_preview"] = str(
                                last_msg.get("body", last_msg.get("text", ""))
                            )[:200]
                    except Exception:
                        pass

                    events.append(event)
                    self._seen_replies.add(key)

                    log_msg = "Positive response" if is_positive else "Reply"
                    logger.info("%s from %s in campaign %s", log_msg, lead_email, name)

        logger.info("Response check complete: %d new responses", len(events))
        return events
