import {
  getAllCampaignAnalytics,
  listCampaigns,
  getAllCampaignLeads,
  deleteLead,
  getMessageHistory,
  getAllEmailHealth,
} from "./smartlead";
import type { BounceEvent, ResponseEvent, MonitoringResult } from "./types";

const BOUNCE_STATUSES = new Set(["bounced", "BOUNCED", "Bounced"]);
const POSITIVE_STATUSES = new Set(["Interested", "interested", "INTERESTED", "Meeting Request"]);
const REPLY_STATUSES = new Set(["replied", "Replied", "REPLIED"]);

export async function runFullMonitoringCycle(): Promise<MonitoringResult> {
  const timestamp = new Date().toISOString();

  // Get campaign analytics
  const campaigns = await getAllCampaignAnalytics();

  // Scan leads for bounces and responses
  const bounces: BounceEvent[] = [];
  const responses: ResponseEvent[] = [];
  const autoDelete = process.env.BOUNCE_AUTO_DELETE !== "false";

  const campaignList = await listCampaigns();

  for (const campaign of campaignList) {
    let leads;
    try {
      leads = await getAllCampaignLeads(campaign.id);
    } catch {
      console.error(`Failed to fetch leads for campaign ${campaign.id}`);
      continue;
    }

    for (const lead of leads) {
      const status = lead.lead_status ?? lead.status ?? "";

      // Check bounces
      if (BOUNCE_STATUSES.has(status)) {
        let deleted = false;
        if (autoDelete) {
          try {
            await deleteLead(campaign.id, lead.id);
            deleted = true;
          } catch {
            console.error(`Failed to delete bounced lead ${lead.id}`);
          }
        }
        bounces.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          lead_id: lead.id,
          email: lead.email,
          deleted,
          detected_at: timestamp,
        });
      }

      // Check positive responses / replies
      const isPositive = POSITIVE_STATUSES.has(status);
      const isReply = REPLY_STATUSES.has(status);

      if (isPositive || isReply) {
        let messagePreview: string | undefined;
        try {
          const messages = await getMessageHistory(campaign.id, lead.id);
          if (messages?.length > 0) {
            const last = messages[messages.length - 1];
            messagePreview = (last.body ?? last.text ?? "").slice(0, 200);
          }
        } catch {
          // Skip message preview
        }

        responses.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          lead_id: lead.id,
          email: lead.email,
          status,
          type: isPositive ? "positive" : "reply",
          message_preview: messagePreview,
          detected_at: timestamp,
        });
      }
    }
  }

  // Email health
  const emailHealth = await getAllEmailHealth();

  return { timestamp, campaigns, bounces, responses, email_health: emailHealth };
}
