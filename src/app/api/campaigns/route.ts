import { NextResponse } from "next/server";
import { getAllCampaignAnalytics } from "@/lib/smartlead";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const campaigns = await getAllCampaignAnalytics();
    return NextResponse.json(campaigns);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
