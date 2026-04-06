import { NextResponse } from "next/server";
import { getAllEmailHealth } from "@/lib/smartlead";
import { configureApiKey } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = configureApiKey(request);
  if (authError) return authError;

  try {
    const health = await getAllEmailHealth();
    return NextResponse.json(health);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
