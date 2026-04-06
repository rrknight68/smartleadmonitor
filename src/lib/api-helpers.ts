import { NextResponse } from "next/server";
import { setApiKey } from "./smartlead";

/**
 * Extract SmartLead API key from the request header and configure the client.
 * Falls back to the SMARTLEAD_API_KEY env var if no header is present.
 * Returns an error response if neither is available.
 */
export function configureApiKey(request: Request): NextResponse | null {
  const headerKey = request.headers.get("x-smartlead-api-key");
  if (headerKey) {
    setApiKey(headerKey);
  } else if (!process.env.SMARTLEAD_API_KEY) {
    return NextResponse.json(
      { error: "API key not configured. Go to Settings to add your SmartLead API key." },
      { status: 401 }
    );
  }
  return null;
}
