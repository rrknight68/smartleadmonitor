export interface Campaign {
  id: number;
  name: string;
  status: string;
  created_at?: string;
}

export interface CampaignAnalytics {
  campaign_id: number;
  name: string;
  status: string;
  total_leads: number;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
}

export interface Lead {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  lead_status?: string;
  status?: string;
}

export interface BounceEvent {
  campaign_id: number;
  campaign_name: string;
  lead_id: number;
  email: string;
  deleted: boolean;
  detected_at: string;
}

export interface ResponseEvent {
  campaign_id: number;
  campaign_name: string;
  lead_id: number;
  email: string;
  status: string;
  type: "positive" | "reply";
  message_preview?: string;
  detected_at: string;
}

export interface EmailAccountHealth {
  account_id: number;
  email: string;
  warmup_enabled: boolean;
  warmup_reputation: number;
  total_sent: number;
  total_bounced: number;
  bounce_rate: number;
  health_status: "healthy" | "warning" | "critical" | "new";
}

export interface MonitoringResult {
  timestamp: string;
  campaigns: CampaignAnalytics[];
  bounces: BounceEvent[];
  responses: ResponseEvent[];
  email_health: EmailAccountHealth[];
}

export interface DashboardData {
  campaigns: CampaignAnalytics[];
  bounces: BounceEvent[];
  responses: ResponseEvent[];
  email_health: EmailAccountHealth[];
  last_check: string | null;
}
