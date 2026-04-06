import type { MonitoringResult } from "./types";

export async function sendSlackNotification(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

export async function sendEmailNotification(
  subject: string, htmlBody: string
): Promise<void> {
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, NOTIFY_EMAIL } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !NOTIFY_EMAIL) return;

  // Using a simple fetch to a mail API or nodemailer in production
  // For Vercel, recommend using a service like Resend, SendGrid, or Postmark
  console.log(`[Email] Would send "${subject}" to ${NOTIFY_EMAIL}`);
}

export function formatMonitoringSummary(result: MonitoringResult): string {
  const lines: string[] = [
    `*SmartLead Monitor Report* - ${new Date(result.timestamp).toLocaleDateString()}`,
    "",
    `*Campaigns:* ${result.campaigns.length}`,
  ];

  // Campaign summary
  for (const c of result.campaigns) {
    const openRate = c.sent > 0 ? ((c.opened / c.sent) * 100).toFixed(1) : "0";
    const replyRate = c.sent > 0 ? ((c.replied / c.sent) * 100).toFixed(1) : "0";
    lines.push(
      `  - ${c.name} [${c.status}]: ${c.sent} sent, ${openRate}% opened, ${replyRate}% replied, ${c.bounced} bounced`
    );
  }

  // Bounces
  if (result.bounces.length > 0) {
    lines.push("", `*Bounces:* ${result.bounces.length}`);
    for (const b of result.bounces.slice(0, 20)) {
      const action = b.deleted ? " (auto-deleted)" : "";
      lines.push(`  - ${b.email} in ${b.campaign_name}${action}`);
    }
  }

  // Positive responses
  const positives = result.responses.filter(r => r.type === "positive");
  if (positives.length > 0) {
    lines.push("", `*Positive Responses:* ${positives.length}`);
    for (const r of positives.slice(0, 20)) {
      lines.push(`  - ${r.email} in ${r.campaign_name}`);
    }
  }

  // Email health issues
  const issues = result.email_health.filter(e => e.health_status === "critical" || e.health_status === "warning");
  if (issues.length > 0) {
    lines.push("", `*Email Health Issues:* ${issues.length}`);
    for (const e of issues) {
      const icon = e.health_status === "critical" ? "🔴" : "🟡";
      lines.push(`  ${icon} ${e.email}: ${e.health_status} (${e.bounce_rate.toFixed(1)}% bounce rate)`);
    }
  }

  return lines.join("\n");
}
