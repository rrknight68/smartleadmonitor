import { NextResponse } from "next/server";
import { testSlackNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { webhook_url } = body;

    if (!webhook_url) {
      return NextResponse.json(
        { success: false, message: "Slack webhook URL is required." },
        { status: 400 }
      );
    }

    const result = await testSlackNotification(webhook_url);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({ success: false, message: String(error) }, { status: 500 });
  }
}
