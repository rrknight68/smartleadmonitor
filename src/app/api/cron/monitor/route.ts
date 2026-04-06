import { NextResponse } from "next/server";
import { runFullMonitoringCycle } from "@/lib/monitor";
import { sendSlackNotification, formatMonitoringSummary } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min max for Vercel Pro

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runFullMonitoringCycle();

    // Send notifications if there are bounces or positive responses
    if (result.bounces.length > 0 || result.responses.length > 0) {
      const summary = formatMonitoringSummary(result);
      await sendSlackNotification(summary);
    }

    return NextResponse.json({
      success: true,
      timestamp: result.timestamp,
      summary: {
        campaigns: result.campaigns.length,
        bounces: result.bounces.length,
        bounces_deleted: result.bounces.filter(b => b.deleted).length,
        responses: result.responses.length,
        positive_responses: result.responses.filter(r => r.type === "positive").length,
        email_accounts: result.email_health.length,
        health_issues: result.email_health.filter(
          e => e.health_status === "critical" || e.health_status === "warning"
        ).length,
      },
    });
  } catch (error) {
    console.error("Monitoring cycle failed:", error);
    return NextResponse.json(
      { error: "Monitoring cycle failed", details: String(error) },
      { status: 500 }
    );
  }
}
