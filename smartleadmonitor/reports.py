import logging
from datetime import datetime

from .api_client import SmartLeadClient
from .monitors.campaign_monitor import CampaignMonitor
from .monitors.email_health_monitor import EmailHealthMonitor
from .notifications import notify

logger = logging.getLogger(__name__)


class ReportGenerator:
    """Generates daily summary and end-of-day reports."""

    def __init__(self, client: SmartLeadClient, campaign_monitor: CampaignMonitor,
                 email_health_monitor: EmailHealthMonitor):
        self.client = client
        self.campaign_monitor = campaign_monitor
        self.email_health_monitor = email_health_monitor
        self._daily_events: list[dict] = []

    def record_event(self, event: dict):
        self._daily_events.append({**event, "recorded_at": datetime.now().isoformat()})

    def record_events(self, events: list[dict]):
        for event in events:
            self.record_event(event)

    def generate_daily_summary(self) -> str:
        """Generate a daily summary report as HTML."""
        now = datetime.now()
        snapshots = self.campaign_monitor.get_all_snapshots()
        health_data = self.email_health_monitor.get_all_health()

        # Count events by type
        event_counts: dict[str, int] = {}
        for event in self._daily_events:
            etype = event.get("type", "unknown")
            event_counts[etype] = event_counts.get(etype, 0) + 1

        bounces_detected = event_counts.get("bounce_detected", 0)
        positive_responses = event_counts.get("positive_response", 0)
        replies = event_counts.get("reply_detected", 0)

        # Build HTML report
        html = f"""
        <html>
        <head><style>
            body {{ font-family: Arial, sans-serif; margin: 20px; color: #333; }}
            h1 {{ color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }}
            h2 {{ color: #2980b9; margin-top: 30px; }}
            table {{ border-collapse: collapse; width: 100%; margin: 15px 0; }}
            th {{ background-color: #3498db; color: white; padding: 10px; text-align: left; }}
            td {{ padding: 8px 10px; border-bottom: 1px solid #ddd; }}
            tr:nth-child(even) {{ background-color: #f8f9fa; }}
            .stat {{ display: inline-block; padding: 15px 25px; margin: 5px; background: #ecf0f1;
                     border-radius: 8px; text-align: center; }}
            .stat-value {{ font-size: 28px; font-weight: bold; color: #2c3e50; }}
            .stat-label {{ font-size: 12px; color: #7f8c8d; margin-top: 5px; }}
            .healthy {{ color: #27ae60; }} .warning {{ color: #f39c12; }} .critical {{ color: #e74c3c; }}
        </style></head>
        <body>
        <h1>SmartLead Daily Summary - {now.strftime('%B %d, %Y')}</h1>

        <div>
            <div class="stat">
                <div class="stat-value">{len(snapshots)}</div>
                <div class="stat-label">Active Campaigns</div>
            </div>
            <div class="stat">
                <div class="stat-value">{positive_responses}</div>
                <div class="stat-label">Positive Responses</div>
            </div>
            <div class="stat">
                <div class="stat-value">{replies}</div>
                <div class="stat-label">Replies</div>
            </div>
            <div class="stat">
                <div class="stat-value">{bounces_detected}</div>
                <div class="stat-label">Bounces</div>
            </div>
        </div>

        <h2>Campaign Overview</h2>
        <table>
        <tr><th>Campaign</th><th>Status</th><th>Leads</th><th>Sent</th>
            <th>Opened</th><th>Clicked</th><th>Replied</th><th>Bounced</th></tr>
        """

        for snap in snapshots:
            html += f"""
            <tr>
                <td>{snap.name}</td><td>{snap.status}</td><td>{snap.total_leads}</td>
                <td>{snap.sent}</td><td>{snap.opened}</td><td>{snap.clicked}</td>
                <td>{snap.replied}</td><td>{snap.bounced}</td>
            </tr>"""

        html += "</table>"

        # Email health section
        html += """
        <h2>Email Account Health</h2>
        <table>
        <tr><th>Email</th><th>Status</th><th>Warmup</th><th>Reputation</th>
            <th>Bounce Rate</th></tr>
        """

        for h in health_data:
            status_class = h.health_status
            warmup_str = "On" if h.warmup_enabled else "Off"
            html += f"""
            <tr>
                <td>{h.email}</td>
                <td class="{status_class}">{h.health_status.upper()}</td>
                <td>{warmup_str}</td>
                <td>{h.warmup_reputation:.0%}</td>
                <td>{h.bounce_rate:.1f}%</td>
            </tr>"""

        html += "</table>"

        # Today's events
        if self._daily_events:
            html += "<h2>Today's Events</h2><ul>"
            for event in self._daily_events[-50:]:  # Last 50 events
                etype = event.get("type", "unknown")
                if etype == "bounce_detected":
                    deleted = " (auto-deleted)" if event.get("deleted") else ""
                    html += f'<li>Bounce: {event.get("email")} in {event.get("campaign_name")}{deleted}</li>'
                elif etype == "positive_response":
                    html += f'<li class="healthy">Positive response: {event.get("email")} in {event.get("campaign_name")}</li>'
                elif etype == "reply_detected":
                    html += f'<li>Reply: {event.get("email")} in {event.get("campaign_name")}</li>'
                elif etype == "email_health_changed":
                    html += f'<li>Email health: {event.get("email")} changed from {event.get("old_status")} to {event.get("new_status")}</li>'
                elif etype == "campaign_status_changed":
                    html += f'<li>Campaign: {event.get("name")} status changed to {event.get("new_status")}</li>'
            html += "</ul>"

        html += "</body></html>"
        return html

    def generate_text_summary(self) -> str:
        """Generate plain text version of the daily summary."""
        now = datetime.now()
        snapshots = self.campaign_monitor.get_all_snapshots()

        event_counts: dict[str, int] = {}
        for event in self._daily_events:
            etype = event.get("type", "unknown")
            event_counts[etype] = event_counts.get(etype, 0) + 1

        lines = [
            f"=== SmartLead Daily Summary - {now.strftime('%B %d, %Y')} ===",
            "",
            f"Active Campaigns: {len(snapshots)}",
            f"Positive Responses: {event_counts.get('positive_response', 0)}",
            f"Replies: {event_counts.get('reply_detected', 0)}",
            f"Bounces: {event_counts.get('bounce_detected', 0)}",
            "",
            "--- Campaign Overview ---",
        ]

        for snap in snapshots:
            lines.append(
                f"  {snap.name} [{snap.status}] - "
                f"Leads: {snap.total_leads}, Sent: {snap.sent}, "
                f"Opened: {snap.opened}, Replied: {snap.replied}, "
                f"Bounced: {snap.bounced}"
            )

        return "\n".join(lines)

    def send_daily_report(self):
        """Generate and send the daily summary report."""
        html = self.generate_daily_summary()
        text = self.generate_text_summary()
        now = datetime.now()

        notify(
            subject=f"SmartLead Daily Summary - {now.strftime('%B %d, %Y')}",
            body_html=html,
            body_text=text,
            slack_text=text,
        )

        logger.info("Daily summary report sent")

    def send_eod_report(self):
        """Generate and send the end-of-day report with full details."""
        html = self.generate_daily_summary()
        text = self.generate_text_summary()
        now = datetime.now()

        notify(
            subject=f"SmartLead End of Day Report - {now.strftime('%B %d, %Y')}",
            body_html=html,
            body_text=text,
            slack_text=f"End of Day Report\n\n{text}",
        )

        # Reset daily events for next day
        self._daily_events.clear()
        logger.info("End-of-day report sent, daily events cleared")
