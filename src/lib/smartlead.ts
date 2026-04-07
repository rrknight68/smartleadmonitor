import type { Campaign, CampaignAnalytics, Lead, EmailAccountHealth } from "./types";

const BASE_URL = "https://server.smartlead.ai/api/v1";

// Module-level override — set by API routes from the request header
let _apiKeyOverride: string | null = null;

export function setApiKey(key: string) {
  _apiKeyOverride = key;
}

async function apiFetch(path: string, options?: RequestInit): Promise<unknown> {
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

/**
 * Extract an array from a response that might be:
 * - A plain array: [...]
 * - Wrapped: { data: [...] }
 * - Wrapped: { campaigns: [...] } etc.
 */
function extractArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    // Try common wrapper keys
    for (const key of ["data", "campaigns", "leads", "email_accounts", "results"]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
    // Try the first key that has an array value
    for (const val of Object.values(obj)) {
      if (Array.isArray(val)) return val;
    }
  }
  return [];
}

// ── Campaigns ──

export async function listCampaigns(): Promise<Campaign[]> {
  const raw = await apiFetch("/campaigns");
  const arr = extractArray(raw);
  return arr.map((item: unknown) => {
    const c = item as Record<string, unknown>;
    return {
      id: c.id as number,
      name: (c.name ?? c.campaign_name ?? "Untitled") as string,
      status: (c.status ?? "unknown") as string,
      created_at: c.created_at as string | undefined,
    };
  });
}

export async function getCampaignAnalytics(campaignId: number): Promise<Record<string, number>> {
  const raw = await apiFetch(`/campaigns/${campaignId}/analytics`);

  // The response might be the analytics object directly, or nested
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    // If there's a data wrapper, unwrap it
    if (obj.data && typeof obj.data === "object") {
      return obj.data as Record<string, number>;
    }
    return obj as Record<string, number>;
  }

  return {};
}

export async function getAllCampaignAnalytics(): Promise<CampaignAnalytics[]> {
  const campaigns = await listCampaigns();
  const results: CampaignAnalytics[] = [];

  for (const campaign of campaigns) {
    try {
      const a = await getCampaignAnalytics(campaign.id);
      results.push({
        campaign_id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        total_leads: num(a.total_leads ?? a.totalLeads),
        sent: num(a.sent ?? a.total_sent ?? a.emails_sent ?? a.totalSent),
        opened: num(a.opened ?? a.total_opened ?? a.emails_opened ?? a.totalOpened ?? a.unique_opened),
        clicked: num(a.clicked ?? a.total_clicked ?? a.emails_clicked ?? a.totalClicked ?? a.unique_clicked),
        replied: num(a.replied ?? a.total_replied ?? a.emails_replied ?? a.totalReplied),
        bounced: num(a.bounced ?? a.total_bounced ?? a.emails_bounced ?? a.totalBounced),
        unsubscribed: num(a.unsubscribed ?? a.total_unsubscribed ?? a.totalUnsubscribed),
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

function num(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseInt(val, 10) || 0;
  return 0;
}

// ── Leads ──

export async function getCampaignLeads(
  campaignId: number, offset = 0, limit = 100
): Promise<Lead[]> {
  const raw = await apiFetch(`/campaigns/${campaignId}/leads?offset=${offset}&limit=${limit}`);
  const arr = extractArray(raw);
  return arr.map((item: unknown) => {
    const l = item as Record<string, unknown>;
    return {
      id: l.id as number,
      email: (l.email ?? "unknown") as string,
      first_name: l.first_name as string | undefined,
      last_name: l.last_name as string | undefined,
      lead_status: (l.lead_status ?? l.status) as string | undefined,
      status: l.status as string | undefined,
    };
  });
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
  const raw = await apiFetch(`/campaigns/${campaignId}/leads/${leadId}/message-history`);
  const arr = extractArray(raw);
  return arr as Array<Record<string, string>>;
}

// ── Email Accounts ──

export async function listEmailAccounts(): Promise<Array<Record<string, unknown>>> {
  const raw = await apiFetch("/email-accounts");
  return extractArray(raw) as Array<Record<string, unknown>>;
}

export function assessEmailHealth(account: Record<string, unknown>): EmailAccountHealth {
  const accountId = (account.id ?? 0) as number;
  const email = (account.from_email ?? account.email ?? "unknown") as string;
  const warmupEnabled = (account.warmup_enabled ?? false) as boolean;
  const warmupReputation = (account.warmup_reputation ?? 0) as number;
  const totalSent = num(account.total_sent ?? account.totalSent ?? 0);
  const totalBounced = num(account.total_bounced ?? account.totalBounced ?? 0);
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
