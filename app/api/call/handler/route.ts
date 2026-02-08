import { NextRequest, NextResponse } from "next/server";
import { callContexts, getResponse } from "@/lib/caller";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const speechResult = (formData.get("SpeechResult") as string) ?? "";
  const callSid = (formData.get("CallSid") as string) ?? "";
  console.log(`[call/handler] callSid=${callSid} speechResult="${speechResult}"`);

  const baseUrl = process.env.BASE_URL || "http://localhost:3000";

  // Get or create default context
  const context = callContexts.get(callSid) ?? {
    companyName: "",
    category: "",
    address: "",
    summary: "",
    website: "",
    script:
      "Hey! How's it going? I'm calling because I think I can really help your business grow. Are you free to talk for a quick minute?",
    transcript: [],
  };

  let twiml: string;

  const hasContext = callContexts.has(callSid);
  console.log(`[call/handler] context found=${hasContext} company="${context.companyName}"`);

  if (!speechResult.trim()) {
    // First message - play personalized script
    console.log(`[call/handler] playing initial script (${context.script.length} chars)`);
    const encodedText = encodeURIComponent(context.script);
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${baseUrl}/api/call/audio?text=${encodedText}</Play>
  <Gather input="speech" action="${baseUrl}/api/call/handler" method="POST" speechTimeout="auto" language="en-US" timeout="15">
    <Say voice="alice">Please respond now.</Say>
  </Gather>
  <Say>I didn't hear anything. Let me try again.</Say>
  <Redirect method="POST">${baseUrl}/api/call/handler</Redirect>
</Response>`;
  } else {
    // User responded - generate AI response
    context.transcript.push({ role: "human", text: speechResult });
    const aiResponse = getResponse(speechResult);
    context.transcript.push({ role: "ai", text: aiResponse });
    console.log(`[call/handler] user said: "${speechResult}" -> responding: "${aiResponse.slice(0, 80)}..."`);
    const encodedResponse = encodeURIComponent(aiResponse);
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${baseUrl}/api/call/audio?text=${encodedResponse}</Play>
  <Gather input="speech" action="${baseUrl}/api/call/handler" method="POST" speechTimeout="auto" language="en-US" timeout="15">
    <Say voice="alice">Please respond.</Say>
  </Gather>
  <Say>Let me know if you have any other questions.</Say>
  <Redirect method="POST">${baseUrl}/api/call/handler</Redirect>
</Response>`;
  }

  return new NextResponse(twiml, {
    headers: { "Content-Type": "application/xml" },
  });
}
