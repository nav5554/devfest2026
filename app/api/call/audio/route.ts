import { NextRequest, NextResponse } from "next/server";
import { generateTTS } from "@/lib/caller";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text");

  if (!text) {
    console.error(`[call/audio] missing text parameter`);
    return NextResponse.json({ error: "text parameter is required" }, { status: 400 });
  }

  const decoded = decodeURIComponent(text);
  console.log(`[call/audio] generating TTS (${decoded.length} chars): "${decoded.slice(0, 60)}..."`);

  try {
    const audioBuffer = await generateTTS(decoded);
    console.log(`[call/audio] TTS generated, ${audioBuffer.length} bytes`);
    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS generation failed";
    console.error(`[call/audio] TTS error:`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
