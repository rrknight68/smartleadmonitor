import { NextResponse } from "next/server";
import { runFullMonitoringCycle } from "@/lib/monitor";
import {
  sendSlackNotification,
  sendEmailNotification,
  formatMonitoringSummary,
} from "@/lib/notifications";
import { generateReportHtml } from "@/lib/report-html";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runFullMonitoringCycle();

    // Send Slack summary
    const slackText = `*End of Day Report*\n\n${formatMonitoringSummary(result)}`;
    await sendSlackNotification(slackText);

    // Send email report
    const html = generateReportHtml(result);
    await sendEmailNotification(
      `SmartLead End of Day Report - ${new Date().toLocaleDateString()}`,
      html
    );

    return NextResponse.json({ success: true, timestamp: result.timestamp });
  } catch (error) {
    console.error("Report generation failed:", error);
    return NextResponse.json(
      { error: "Report generation failed", details: String(error) },
      { status: 500 }
    );
  }
}
