import { NextResponse } from "next/server";
import { listCampaigns, getAllCampaignLeads } from "@/lib/smartlead";
import type { ResponseEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

const POSITIVE_STATUSES = new Set(["Interested", "interested", "INTERESTED", "Meeting Request"]);
const REPLY_STATUSES = new Set(["replied", "Replied", "REPLIED"]);

export async function GET() {
  try {
    const campaigns = await listCampaigns();
    const responses: ResponseEvent[] = [];

    for (const campaign of campaigns) {
      let leads;
      try {
        leads = await getAllCampaignLeads(campaign.id);
      } catch {
        continue;
      }

      for (const lead of leads) {
        const status = lead.lead_status ?? lead.status ?? "";
        const isPositive = POSITIVE_STATUSES.has(status);
        const isReply = REPLY_STATUSES.has(status);

        if (isPositive || isReply) {
          responses.push({
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            lead_id: lead.id,
            email: lead.email,
            status,
            type: isPositive ? "positive" : "reply",
            detected_at: new Date().toISOString(),
          });
        }
      }
    }

    return NextResponse.json(responses);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
