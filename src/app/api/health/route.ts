import { NextResponse } from "next/server";
import { getAllEmailHealth } from "@/lib/smartlead";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await getAllEmailHealth();
    return NextResponse.json(health);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
