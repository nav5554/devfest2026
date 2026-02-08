import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const callSid = request.nextUrl.searchParams.get("callSid");

  if (!callSid) {
    return NextResponse.json(
      { error: "callSid parameter is required" },
      { status: 400 }
    );
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return NextResponse.json(
      { error: "Twilio credentials not configured" },
      { status: 500 }
    );
  }

  try {
    const client = twilio(accountSid, authToken);
    const call = await client.calls(callSid).fetch();
    console.log(
      `[call-status] sid=${callSid} status=${call.status} duration=${call.duration}`
    );
    return NextResponse.json({
      status: call.status,
      duration: call.duration,
    });
  } catch (err) {
    console.error(`[call-status] error:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch status" },
      { status: 500 }
    );
  }
}
