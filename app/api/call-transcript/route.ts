import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { callContexts } from "@/lib/caller";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const callSid = request.nextUrl.searchParams.get("callSid");

  if (!callSid) {
    return NextResponse.json(
      { error: "callSid parameter is required" },
      { status: 400 }
    );
  }

  const context = callContexts.get(callSid);
  if (!context) {
    return NextResponse.json(
      { error: "Call context not found", transcript: [], classification: null },
    );
  }

  const transcript = context.transcript;
  const live = request.nextUrl.searchParams.get("live") === "true";
  console.log(`[call-transcript] sid=${callSid} turns=${transcript.length} live=${live}`);

  // Skip classification during live calls - just return transcript
  if (live) {
    return NextResponse.json({
      transcript,
      classification: null,
      companyName: context.companyName,
    });
  }

  // Use Gemini to classify interest from transcript
  let classification: "interested" | "not_interested" | "unreachable" | null = null;

  if (transcript.length > 1) {
    classification = await classifyInterest(context.companyName, transcript);
    console.log(`[call-transcript] classification=${classification}`);
  }

  return NextResponse.json({
    transcript,
    classification,
    companyName: context.companyName,
  });
}

async function classifyInterest(
  companyName: string,
  transcript: { role: "ai" | "human"; text: string }[]
): Promise<"interested" | "not_interested" | "unreachable"> {
  const convo = transcript
    .map((t) => `${t.role === "ai" ? "AI Caller" : companyName}: ${t.text}`)
    .join("\n");

  try {
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt:
        `Analyze this sales call transcript and classify the business's response.\n\n` +
        `Transcript:\n${convo}\n\n` +
        `Classify as exactly one of:\n` +
        `- "interested" — they showed interest, agreed to talk more, asked questions, wanted to schedule\n` +
        `- "not_interested" — they declined, said no, asked to be removed, hung up\n` +
        `- "unreachable" — no meaningful response, voicemail, couldn't connect\n\n` +
        `Return ONLY one word: interested, not_interested, or unreachable`,
    });

    const cleaned = text.trim().toLowerCase().replace(/[^a-z_]/g, "");
    if (cleaned === "interested" || cleaned === "not_interested" || cleaned === "unreachable") {
      return cleaned;
    }
    return "unreachable";
  } catch (err) {
    console.error(`[call-transcript] classification error:`, err);
    return "unreachable";
  }
}
