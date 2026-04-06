import { NextResponse } from "next/server";
import { listCampaigns, getAllCampaignLeads } from "@/lib/smartlead";
import { configureApiKey } from "@/lib/api-helpers";
import type { BounceEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

const BOUNCE_STATUSES = new Set(["bounced", "BOUNCED", "Bounced"]);

export async function GET(request: Request) {
  const authError = configureApiKey(request);
  if (authError) return authError;

  try {
    const campaigns = await listCampaigns();
    const bounces: BounceEvent[] = [];

    for (const campaign of campaigns) {
      let leads;
      try {
        leads = await getAllCampaignLeads(campaign.id);
      } catch {
        continue;
      }

      for (const lead of leads) {
        const status = lead.lead_status ?? lead.status ?? "";
        if (BOUNCE_STATUSES.has(status)) {
          bounces.push({
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            lead_id: lead.id,
            email: lead.email,
            deleted: false,
            detected_at: new Date().toISOString(),
          });
        }
      }
    }

    return NextResponse.json(bounces);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
