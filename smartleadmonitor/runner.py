import logging
import signal
import sys
import time

import schedule
from rich.console import Console
from rich.logging import RichHandler
from rich.table import Table

from .api_client import SmartLeadClient
from .config import Config
from .monitors import BounceMonitor, CampaignMonitor, EmailHealthMonitor, ResponseMonitor
from .reports import ReportGenerator

console = Console()
logger = logging.getLogger(__name__)


class SmartLeadRunner:
    """Main application runner with scheduling."""

    def __init__(self):
        Config.validate()
        self.client = SmartLeadClient()

        self.campaign_monitor = CampaignMonitor(self.client)
        self.bounce_monitor = BounceMonitor(self.client)
        self.response_monitor = ResponseMonitor(self.client)
        self.email_health_monitor = EmailHealthMonitor(self.client)
        self.report_generator = ReportGenerator(
            self.client, self.campaign_monitor, self.email_health_monitor
        )

        self._running = True

    def run_monitoring_cycle(self):
        """Run a single monitoring cycle across all monitors."""
        console.rule("[bold blue]Running Monitoring Cycle")

        # Campaign monitoring
        try:
            events = self.campaign_monitor.check()
            self.report_generator.record_events(events)
            self._display_campaign_events(events)
        except Exception:
            logger.error("Campaign monitoring failed", exc_info=True)

        # Bounce monitoring
        try:
            events = self.bounce_monitor.check()
            self.report_generator.record_events(events)
            self._display_bounce_events(events)
        except Exception:
            logger.error("Bounce monitoring failed", exc_info=True)

        # Response monitoring
        try:
            events = self.response_monitor.check()
            self.report_generator.record_events(events)
            self._display_response_events(events)
        except Exception:
            logger.error("Response monitoring failed", exc_info=True)

        # Email health monitoring
        try:
            events = self.email_health_monitor.check()
            self.report_generator.record_events(events)
            self._display_health_events(events)
        except Exception:
            logger.error("Email health monitoring failed", exc_info=True)

        console.rule("[dim]Cycle Complete")

    def _display_campaign_events(self, events: list[dict]):
        if not events:
            return
        table = Table(title="Campaign Updates")
        table.add_column("Campaign", style="cyan")
        table.add_column("Event", style="green")
        table.add_column("Details")

        for event in events:
            if event["type"] == "campaign_discovered":
                snap = event["snapshot"]
                table.add_row(
                    event["name"], "Discovered",
                    f"Status: {event['status']}, Leads: {snap.total_leads}"
                )
            elif event["type"] == "campaign_status_changed":
                table.add_row(
                    event["name"], "Status Changed",
                    f"{event['old_status']} -> {event['new_status']}"
                )
            elif event["type"] == "campaign_metrics_changed":
                changes = event["changes"]
                details = ", ".join(
                    f"{k}: +{v['delta']}" for k, v in changes.items()
                )
                table.add_row(event["name"], "Metrics Updated", details)

        console.print(table)

    def _display_bounce_events(self, events: list[dict]):
        if not events:
            return
        for event in events:
            deleted = " [bold red](AUTO-DELETED)[/]" if event["deleted"] else ""
            console.print(
                f"  [red]BOUNCE:[/] {event['email']} in {event['campaign_name']}{deleted}"
            )

    def _display_response_events(self, events: list[dict]):
        if not events:
            return
        for event in events:
            if event["type"] == "positive_response":
                console.print(
                    f"  [bold green]POSITIVE:[/] {event['email']} in {event['campaign_name']}"
                )
            else:
                console.print(
                    f"  [green]REPLY:[/] {event['email']} in {event['campaign_name']}"
                )

    def _display_health_events(self, events: list[dict]):
        if not events:
            return
        for event in events:
            status = event.get("health_status", event.get("new_status", ""))
            style = {"healthy": "green", "warning": "yellow", "critical": "red"}.get(status, "white")
            console.print(
                f"  [{style}]EMAIL HEALTH:[/] {event['email']} - {status.upper()}"
            )

    def run_daily_summary(self):
        """Send the daily summary report."""
        console.print("[bold blue]Sending daily summary report...[/]")
        try:
            self.report_generator.send_daily_report()
            console.print("[green]Daily summary sent![/]")
        except Exception:
            logger.error("Failed to send daily summary", exc_info=True)

    def run_eod_report(self):
        """Send end-of-day report."""
        console.print("[bold blue]Sending end-of-day report...[/]")
        try:
            self.report_generator.send_eod_report()
            console.print("[green]End-of-day report sent![/]")
        except Exception:
            logger.error("Failed to send EOD report", exc_info=True)

    def setup_schedule(self):
        """Set up the monitoring schedule."""
        interval = Config.CHECK_INTERVAL_MINUTES

        # Monitoring cycle runs at configured interval
        schedule.every(interval).minutes.do(self.run_monitoring_cycle)

        # Daily summary at 12:00 PM
        schedule.every().day.at("12:00").do(self.run_daily_summary)

        # End-of-day report at 6:00 PM
        schedule.every().day.at("18:00").do(self.run_eod_report)

        console.print(f"[bold]Schedule configured:[/]")
        console.print(f"  Monitoring cycle: every {interval} minutes")
        console.print(f"  Daily summary: 12:00 PM")
        console.print(f"  End-of-day report: 6:00 PM")

    def start(self):
        """Start the monitoring loop."""
        console.print("[bold green]SmartLead Campaign Monitor Starting...[/]")
        console.print(f"  API Key: ...{Config.SMARTLEAD_API_KEY[-6:]}")
        console.print(f"  Auto-delete bounces: {Config.BOUNCE_AUTO_DELETE}")
        console.print()

        # Handle graceful shutdown
        def signal_handler(sig, frame):
            console.print("\n[yellow]Shutting down...[/]")
            self._running = False

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        # Run initial cycle
        self.run_monitoring_cycle()

        # Set up schedule
        self.setup_schedule()

        # Main loop
        while self._running:
            schedule.run_pending()
            time.sleep(1)

        console.print("[bold]Monitor stopped.[/]")

    def run_once(self):
        """Run a single monitoring cycle and print report (no scheduling)."""
        console.print("[bold green]SmartLead Campaign Monitor - One-time Check[/]")
        console.print()
        self.run_monitoring_cycle()
        console.print()

        # Print summary
        text = self.report_generator.generate_text_summary()
        console.print(text)
