import { NextResponse } from "next/server";
import { setApiKey, listCampaigns } from "@/lib/smartlead";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiKey = body.api_key;

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    setApiKey(apiKey);
    const campaigns = await listCampaigns();

    return NextResponse.json({
      success: true,
      message: `Connected successfully. Found ${campaigns.length} campaign${campaigns.length !== 1 ? "s" : ""}.`,
      campaign_count: campaigns.length,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: `Connection failed: ${String(error)}`,
    }, { status: 400 });
  }
}
