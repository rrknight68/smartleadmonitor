import nodemailer from "nodemailer";
import type { MonitoringResult } from "./types";

export interface NotificationLog {
  id: string;
  type: "email" | "slack";
  subject: string;
  recipient: string;
  status: "sent" | "failed";
  error?: string;
  timestamp: string;
}

// In-memory log (persists for the lifetime of the serverless function / cold start)
// For production persistence, swap this with a database or KV store
const notificationLogs: NotificationLog[] = [];
const MAX_LOGS = 200;

function addLog(log: Omit<NotificationLog, "id" | "timestamp">) {
  const entry: NotificationLog = {
    ...log,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  notificationLogs.unshift(entry);
  if (notificationLogs.length > MAX_LOGS) {
    notificationLogs.length = MAX_LOGS;
  }
  return entry;
}

export function getNotificationLogs(): NotificationLog[] {
  return notificationLogs;
}

// ── Email ──

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  to: string;
}

function getEmailConfig(): EmailConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const to = process.env.NOTIFY_EMAIL;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);

  if (!host || !user || !password || !to) return null;
  return { host, port, user, password, to };
}

export async function sendEmailNotification(
  subject: string,
  htmlBody: string,
  configOverride?: Partial<EmailConfig>
): Promise<boolean> {
  const config = getEmailConfig();
  const host = configOverride?.host || config?.host;
  const port = configOverride?.port || config?.port || 587;
  const user = configOverride?.user || config?.user;
  const password = configOverride?.password || config?.password;
  const to = configOverride?.to || config?.to;

  if (!host || !user || !password || !to) {
    console.log("[Email] Not configured, skipping:", subject);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: password },
    });

    await transporter.sendMail({
      from: user,
      to,
      subject,
      html: htmlBody,
    });

    addLog({ type: "email", subject, recipient: to, status: "sent" });
    console.log(`[Email] Sent: "${subject}" to ${to}`);
    return true;
  } catch (error) {
    const errMsg = String(error);
    addLog({ type: "email", subject, recipient: to, status: "failed", error: errMsg });
    console.error(`[Email] Failed: "${subject}" to ${to}:`, errMsg);
    return false;
  }
}

// ── Slack ──

export async function sendSlackNotification(
  text: string,
  webhookUrlOverride?: string
): Promise<boolean> {
  const webhookUrl = webhookUrlOverride || process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log("[Slack] Not configured, skipping notification");
    return false;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      throw new Error(`Slack responded with ${res.status}`);
    }

    addLog({
      type: "slack",
      subject: text.slice(0, 80) + (text.length > 80 ? "..." : ""),
      recipient: "Slack webhook",
      status: "sent",
    });
    console.log("[Slack] Notification sent");
    return true;
  } catch (error) {
    const errMsg = String(error);
    addLog({
      type: "slack",
      subject: text.slice(0, 80),
      recipient: "Slack webhook",
      status: "failed",
      error: errMsg,
    });
    console.error("[Slack] Failed:", errMsg);
    return false;
  }
}

// ── Test notifications ──

export async function testEmailNotification(config: EmailConfig): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.password },
    });

    await transporter.sendMail({
      from: config.user,
      to: config.to,
      subject: "SmartLead Monitor - Test Email",
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px">
          <h2 style="color:#2c3e50">SmartLead Monitor</h2>
          <p style="color:#27ae60;font-size:18px">Email notifications are working!</p>
          <p style="color:#7f8c8d">This is a test email from your SmartLead Monitor dashboard.</p>
          <p style="color:#7f8c8d;font-size:12px">Sent at ${new Date().toLocaleString()}</p>
        </div>
      `,
    });

    addLog({ type: "email", subject: "Test Email", recipient: config.to, status: "sent" });
    return { success: true, message: `Test email sent to ${config.to}` };
  } catch (error) {
    const errMsg = String(error);
    addLog({ type: "email", subject: "Test Email", recipient: config.to, status: "failed", error: errMsg });
    return { success: false, message: `Failed: ${errMsg}` };
  }
}

export async function testSlackNotification(webhookUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "SmartLead Monitor - Test notification. Slack is connected!" }),
    });

    if (!res.ok) throw new Error(`Slack responded with ${res.status}`);

    addLog({ type: "slack", subject: "Test Notification", recipient: "Slack webhook", status: "sent" });
    return { success: true, message: "Test notification sent to Slack" };
  } catch (error) {
    const errMsg = String(error);
    addLog({ type: "slack", subject: "Test Notification", recipient: "Slack webhook", status: "failed", error: errMsg });
    return { success: false, message: `Failed: ${errMsg}` };
  }
}

// ── Formatting ──

export function formatMonitoringSummary(result: MonitoringResult): string {
  const lines: string[] = [
    `*SmartLead Monitor Report* - ${new Date(result.timestamp).toLocaleDateString()}`,
    "",
    `*Campaigns:* ${result.campaigns.length}`,
  ];

  for (const c of result.campaigns) {
    const openRate = c.sent > 0 ? ((c.opened / c.sent) * 100).toFixed(1) : "0";
    const replyRate = c.sent > 0 ? ((c.replied / c.sent) * 100).toFixed(1) : "0";
    lines.push(
      `  - ${c.name} [${c.status}]: ${c.sent} sent, ${openRate}% opened, ${replyRate}% replied, ${c.bounced} bounced`
    );
  }

  if (result.bounces.length > 0) {
    lines.push("", `*Bounces:* ${result.bounces.length}`);
    for (const b of result.bounces.slice(0, 20)) {
      const action = b.deleted ? " (auto-deleted)" : "";
      lines.push(`  - ${b.email} in ${b.campaign_name}${action}`);
    }
  }

  const positives = result.responses.filter(r => r.type === "positive");
  if (positives.length > 0) {
    lines.push("", `*Positive Responses:* ${positives.length}`);
    for (const r of positives.slice(0, 20)) {
      lines.push(`  - ${r.email} in ${r.campaign_name}`);
    }
  }

  const issues = result.email_health.filter(e => e.health_status === "critical" || e.health_status === "warning");
  if (issues.length > 0) {
    lines.push("", `*Email Health Issues:* ${issues.length}`);
    for (const e of issues) {
      lines.push(`  - ${e.email}: ${e.health_status.toUpperCase()} (${e.bounce_rate.toFixed(1)}% bounce rate)`);
    }
  }

  return lines.join("\n");
}
