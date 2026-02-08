import { stopActiveSession, isSessionActive } from "@/lib/browser-use";
import { NextResponse } from "next/server";

export async function POST() {
  await stopActiveSession();
  return NextResponse.json({ success: true, message: "Session reset." });
}

export async function GET() {
  return NextResponse.json({ active: isSessionActive() });
}
