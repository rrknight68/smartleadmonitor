import type { MonitoringResult } from "./types";

export function generateReportHtml(result: MonitoringResult): string {
  const date = new Date(result.timestamp).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const positiveCount = result.responses.filter(r => r.type === "positive").length;
  const replyCount = result.responses.filter(r => r.type === "reply").length;

  let campaignRows = "";
  for (const c of result.campaigns) {
    const openRate = c.sent > 0 ? ((c.opened / c.sent) * 100).toFixed(1) : "0";
    const replyRate = c.sent > 0 ? ((c.replied / c.sent) * 100).toFixed(1) : "0";
    campaignRows += `<tr>
      <td>${c.name}</td><td>${c.status}</td><td>${c.total_leads}</td>
      <td>${c.sent}</td><td>${c.opened} (${openRate}%)</td>
      <td>${c.clicked}</td><td>${c.replied} (${replyRate}%)</td><td>${c.bounced}</td>
    </tr>`;
  }

  let healthRows = "";
  for (const h of result.email_health) {
    const statusColor = h.health_status === "critical" ? "#e74c3c"
      : h.health_status === "warning" ? "#f39c12" : "#27ae60";
    healthRows += `<tr>
      <td>${h.email}</td>
      <td style="color:${statusColor};font-weight:bold">${h.health_status.toUpperCase()}</td>
      <td>${h.warmup_enabled ? "On" : "Off"}</td>
      <td>${(h.warmup_reputation * 100).toFixed(0)}%</td>
      <td>${h.bounce_rate.toFixed(1)}%</td>
    </tr>`;
  }

  let bounceSection = "";
  if (result.bounces.length > 0) {
    const rows = result.bounces.slice(0, 50).map(b =>
      `<li>${b.email} in ${b.campaign_name}${b.deleted ? " <em>(auto-deleted)</em>" : ""}</li>`
    ).join("");
    bounceSection = `<h2>Bounces (${result.bounces.length})</h2><ul>${rows}</ul>`;
  }

  let responseSection = "";
  if (result.responses.length > 0) {
    const rows = result.responses.slice(0, 50).map(r =>
      `<li><strong>${r.type === "positive" ? "INTERESTED" : "REPLY"}</strong>: ${r.email} in ${r.campaign_name}</li>`
    ).join("");
    responseSection = `<h2>Responses (${result.responses.length})</h2><ul>${rows}</ul>`;
  }

  return `<!DOCTYPE html><html><head><style>
    body{font-family:Arial,sans-serif;margin:20px;color:#333}
    h1{color:#2c3e50;border-bottom:2px solid #3498db;padding-bottom:10px}
    h2{color:#2980b9;margin-top:30px}
    table{border-collapse:collapse;width:100%;margin:15px 0}
    th{background:#3498db;color:#fff;padding:10px;text-align:left}
    td{padding:8px 10px;border-bottom:1px solid #ddd}
    tr:nth-child(even){background:#f8f9fa}
    .stat{display:inline-block;padding:15px 25px;margin:5px;background:#ecf0f1;border-radius:8px;text-align:center}
    .stat-value{font-size:28px;font-weight:bold;color:#2c3e50}
    .stat-label{font-size:12px;color:#7f8c8d;margin-top:5px}
  </style></head><body>
  <h1>SmartLead Report - ${date}</h1>
  <div>
    <div class="stat"><div class="stat-value">${result.campaigns.length}</div><div class="stat-label">Campaigns</div></div>
    <div class="stat"><div class="stat-value">${positiveCount}</div><div class="stat-label">Positive</div></div>
    <div class="stat"><div class="stat-value">${replyCount}</div><div class="stat-label">Replies</div></div>
    <div class="stat"><div class="stat-value">${result.bounces.length}</div><div class="stat-label">Bounces</div></div>
  </div>
  <h2>Campaign Overview</h2>
  <table><tr><th>Campaign</th><th>Status</th><th>Leads</th><th>Sent</th><th>Opened</th><th>Clicked</th><th>Replied</th><th>Bounced</th></tr>${campaignRows}</table>
  <h2>Email Account Health</h2>
  <table><tr><th>Email</th><th>Status</th><th>Warmup</th><th>Reputation</th><th>Bounce Rate</th></tr>${healthRows}</table>
  ${bounceSection}
  ${responseSection}
  </body></html>`;
}
