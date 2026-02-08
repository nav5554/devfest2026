import { resetStagehand, isSessionActive } from "@/lib/stagehand";
import { NextResponse } from "next/server";

export async function POST() {
  await resetStagehand();
  return NextResponse.json({ success: true, message: "Session reset." });
}

export async function GET() {
  return NextResponse.json({ active: isSessionActive() });
}
