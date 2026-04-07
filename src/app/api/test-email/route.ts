import { NextResponse } from "next/server";
import { testEmailNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { smtp_host, smtp_port, smtp_user, smtp_password, notify_email } = body;

    if (!smtp_host || !smtp_user || !smtp_password || !notify_email) {
      return NextResponse.json(
        { success: false, message: "All email fields are required (SMTP host, user, password, recipient)." },
        { status: 400 }
      );
    }

    const result = await testEmailNotification({
      host: smtp_host,
      port: parseInt(smtp_port || "587", 10),
      user: smtp_user,
      password: smtp_password,
      to: notify_email,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({ success: false, message: String(error) }, { status: 500 });
  }
}
