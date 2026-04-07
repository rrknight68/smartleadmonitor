import { NextResponse } from "next/server";
import { getNotificationLogs } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const logs = getNotificationLogs();
  return NextResponse.json(logs);
}
