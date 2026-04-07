import { NextResponse } from "next/server";
import { setApiKey } from "@/lib/smartlead";

export const dynamic = "force-dynamic";

const BASE_URL = "https://server.smartlead.ai/api/v1";

export async function GET(request: Request) {
  const headerKey = request.headers.get("x-smartlead-api-key");
  const apiKey = headerKey || process.env.SMARTLEAD_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "No API key" }, { status: 401 });
  }

  if (headerKey) setApiKey(headerKey);

  const results: Record<string, unknown> = {};

  // Fetch raw campaigns list
  try {
    const res = await fetch(`${BASE_URL}/campaigns?api_key=${apiKey}`);
    const raw = await res.json();
    results.campaigns_raw = raw;
    results.campaigns_type = typeof raw;
    results.campaigns_is_array = Array.isArray(raw);

    // If we got campaigns, try analytics on the first one
    const campaignList = Array.isArray(raw) ? raw : raw?.data ?? raw?.campaigns ?? [];
    if (campaignList.length > 0) {
      const firstId = campaignList[0].id;
      results.first_campaign = campaignList[0];

      const analyticsRes = await fetch(`${BASE_URL}/campaigns/${firstId}/analytics?api_key=${apiKey}`);
      const analyticsRaw = await analyticsRes.json();
      results.analytics_raw = analyticsRaw;
      results.analytics_type = typeof analyticsRaw;

      // Also try leads
      const leadsRes = await fetch(`${BASE_URL}/campaigns/${firstId}/leads?api_key=${apiKey}&offset=0&limit=5`);
      const leadsRaw = await leadsRes.json();
      results.leads_raw = leadsRaw;
      results.leads_type = typeof leadsRaw;
      results.leads_is_array = Array.isArray(leadsRaw);
    }
  } catch (error) {
    results.error = String(error);
  }

  return NextResponse.json(results, { status: 200 });
}
