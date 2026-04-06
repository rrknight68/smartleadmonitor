import type { Campaign, CampaignAnalytics, Lead, EmailAccountHealth } from "./types";

const BASE_URL = "https://server.smartlead.ai/api/v1";

// Module-level override — set by API routes from the request header
let _apiKeyOverride: string | null = null;

export function setApiKey(key: string) {
  _apiKeyOverride = key;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const apiKey = _apiKeyOverride || process.env.SMARTLEAD_API_KEY;
  if (!apiKey) throw new Error("SMARTLEAD_API_KEY not set");

  const separator = path.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${path}${separator}api_key=${apiKey}`;

  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });

  if (res.status === 429) {
    throw new Error("SmartLead rate limit hit. Try again later.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SmartLead API ${res.status}: ${text}`);
  }

  return res.json();
}

// ── Campaigns ──

export async function listCampaigns(): Promise<Campaign[]> {
  return apiFetch<Campaign[]>("/campaigns");
}

export async function getCampaignAnalytics(campaignId: number): Promise<Record<string, number>> {
  return apiFetch<Record<string, number>>(`/campaigns/${campaignId}/analytics`);
}

export async function getAllCampaignAnalytics(): Promise<CampaignAnalytics[]> {
  const campaigns = await listCampaigns();
  const results: CampaignAnalytics[] = [];

  for (const campaign of campaigns) {
    try {
      const analytics = await getCampaignAnalytics(campaign.id);
      results.push({
        campaign_id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        total_leads: analytics.total_leads ?? 0,
        sent: analytics.sent ?? analytics.total_sent ?? 0,
        opened: analytics.opened ?? analytics.total_opened ?? 0,
        clicked: analytics.clicked ?? analytics.total_clicked ?? 0,
        replied: analytics.replied ?? analytics.total_replied ?? 0,
        bounced: analytics.bounced ?? analytics.total_bounced ?? 0,
        unsubscribed: analytics.unsubscribed ?? analytics.total_unsubscribed ?? 0,
      });
    } catch {
      results.push({
        campaign_id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        total_leads: 0, sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, unsubscribed: 0,
      });
    }
  }

  return results;
}

// ── Leads ──

export async function getCampaignLeads(
  campaignId: number, offset = 0, limit = 100
): Promise<Lead[]> {
  return apiFetch<Lead[]>(`/campaigns/${campaignId}/leads?offset=${offset}&limit=${limit}`);
}

export async function getAllCampaignLeads(campaignId: number): Promise<Lead[]> {
  const allLeads: Lead[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const batch = await getCampaignLeads(campaignId, offset, limit);
    if (!batch || batch.length === 0) break;
    allLeads.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return allLeads;
}

export async function deleteLead(campaignId: number, leadId: number): Promise<void> {
  await apiFetch(`/campaigns/${campaignId}/leads/${leadId}`, { method: "DELETE" });
}

export async function getMessageHistory(campaignId: number, leadId: number): Promise<Array<Record<string, string>>> {
  return apiFetch(`/campaigns/${campaignId}/leads/${leadId}/message-history`);
}

// ── Email Accounts ──

export async function listEmailAccounts(): Promise<Array<Record<string, unknown>>> {
  return apiFetch("/email-accounts");
}

export function assessEmailHealth(account: Record<string, unknown>): EmailAccountHealth {
  const accountId = (account.id ?? 0) as number;
  const email = (account.from_email ?? account.email ?? "unknown") as string;
  const warmupEnabled = (account.warmup_enabled ?? false) as boolean;
  const warmupReputation = (account.warmup_reputation ?? 0) as number;
  const totalSent = (account.total_sent ?? 0) as number;
  const totalBounced = (account.total_bounced ?? 0) as number;
  const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;

  let healthStatus: EmailAccountHealth["health_status"];
  if (totalSent === 0) {
    healthStatus = "new";
  } else if (bounceRate > 10) {
    healthStatus = "critical";
  } else if (bounceRate > 5 || (warmupReputation > 0 && warmupReputation < 0.85)) {
    healthStatus = "warning";
  } else {
    healthStatus = "healthy";
  }

  return {
    account_id: accountId,
    email,
    warmup_enabled: warmupEnabled,
    warmup_reputation: warmupReputation,
    total_sent: totalSent,
    total_bounced: totalBounced,
    bounce_rate: bounceRate,
    health_status: healthStatus,
  };
}

export async function getAllEmailHealth(): Promise<EmailAccountHealth[]> {
  const accounts = await listEmailAccounts();
  return accounts.map(assessEmailHealth);
}
