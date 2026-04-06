#!/usr/bin/env python3
"""SmartLead Campaign Monitor - Entry point."""

import argparse
import logging
import sys

from rich.logging import RichHandler

from smartleadmonitor.runner import SmartLeadRunner


def setup_logging(level: str = "INFO"):
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(message)s",
        datefmt="%H:%M:%S",
        handlers=[RichHandler(rich_tracebacks=True)],
    )


def main():
    parser = argparse.ArgumentParser(description="SmartLead Campaign Monitor")
    parser.add_argument("--once", action="store_true", help="Run a single check and exit")
    parser.add_argument("--report", action="store_true", help="Generate and send a report now")
    parser.add_argument("--log-level", default="INFO", help="Log level (DEBUG, INFO, WARNING, ERROR)")
    args = parser.parse_args()

    setup_logging(args.log_level)

    try:
        runner = SmartLeadRunner()
    except ValueError as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        sys.exit(1)

    if args.once:
        runner.run_once()
    elif args.report:
        runner.run_monitoring_cycle()
        runner.run_daily_summary()
    else:
        runner.start()


if __name__ == "__main__":
    main()
