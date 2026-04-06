import logging
import time
from typing import Any

import requests

from .config import Config

logger = logging.getLogger(__name__)


class SmartLeadClient:
    """Client for the SmartLead API (v1)."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or Config.SMARTLEAD_API_KEY
        self.base_url = Config.BASE_URL
        self.session = requests.Session()

    def _request(self, method: str, path: str, params: dict | None = None,
                 json_data: dict | None = None) -> Any:
        url = f"{self.base_url}{path}"
        params = params or {}
        params["api_key"] = self.api_key

        for attempt in range(3):
            try:
                resp = self.session.request(method, url, params=params, json=json_data, timeout=30)
                resp.raise_for_status()
                return resp.json()
            except requests.exceptions.HTTPError as e:
                if resp.status_code == 429:
                    wait = 2 ** attempt
                    logger.warning("Rate limited, retrying in %ds...", wait)
                    time.sleep(wait)
                    continue
                logger.error("HTTP %s for %s: %s", resp.status_code, path, e)
                raise
            except requests.exceptions.RequestException as e:
                if attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                logger.error("Request failed for %s: %s", path, e)
                raise
        return None

    def _get(self, path: str, params: dict | None = None) -> Any:
        return self._request("GET", path, params=params)

    def _post(self, path: str, json_data: dict | None = None, params: dict | None = None) -> Any:
        return self._request("POST", path, params=params, json_data=json_data)

    def _delete(self, path: str, params: dict | None = None) -> Any:
        return self._request("DELETE", path, params=params)

    # ── Campaigns ──

    def list_campaigns(self) -> list[dict]:
        return self._get("/campaigns") or []

    def get_campaign(self, campaign_id: int) -> dict:
        return self._get(f"/campaigns/{campaign_id}")

    def get_campaign_analytics(self, campaign_id: int) -> dict:
        return self._get(f"/campaigns/{campaign_id}/analytics")

    # ── Leads ──

    def get_campaign_leads(self, campaign_id: int, offset: int = 0,
                           limit: int = 100) -> list[dict]:
        return self._get(f"/campaigns/{campaign_id}/leads", params={
            "offset": offset,
            "limit": limit,
        }) or []

    def get_all_campaign_leads(self, campaign_id: int) -> list[dict]:
        all_leads = []
        offset = 0
        limit = 100
        while True:
            batch = self.get_campaign_leads(campaign_id, offset=offset, limit=limit)
            if not batch:
                break
            all_leads.extend(batch)
            if len(batch) < limit:
                break
            offset += limit
        return all_leads

    def get_lead_by_id(self, campaign_id: int, lead_id: int) -> dict:
        return self._get(f"/campaigns/{campaign_id}/leads/{lead_id}")

    def delete_lead(self, campaign_id: int, lead_id: int) -> dict:
        return self._delete(f"/campaigns/{campaign_id}/leads/{lead_id}")

    def update_lead_status(self, campaign_id: int, lead_id: int, status: str) -> dict:
        return self._post(f"/campaigns/{campaign_id}/leads/{lead_id}/status", json_data={
            "status": status,
        })

    # ── Email Accounts ──

    def list_email_accounts(self) -> list[dict]:
        return self._get("/email-accounts") or []

    def get_email_account(self, account_id: int) -> dict:
        return self._get(f"/email-accounts/{account_id}")

    def get_email_account_by_campaign(self, campaign_id: int) -> list[dict]:
        return self._get(f"/campaigns/{campaign_id}/email-accounts") or []

    # ── Message History ──

    def get_message_history(self, campaign_id: int, lead_id: int) -> list[dict]:
        return self._get(f"/campaigns/{campaign_id}/leads/{lead_id}/message-history") or []
