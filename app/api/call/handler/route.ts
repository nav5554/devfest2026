import { NextRequest, NextResponse } from "next/server";
import { callContexts, getResponse, generateTTS, audioCache } from "@/lib/caller";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const speechResult = (formData.get("SpeechResult") as string) ?? "";
  const callSid = (formData.get("CallSid") as string) ?? "";
  console.log(`[call/handler] callSid=${callSid} speechResult="${speechResult}"`);

  const baseUrl = process.env.BASE_URL || "http://localhost:3000";

  const context = callContexts.get(callSid) ?? {
    companyName: "",
    category: "",
    address: "",
    summary: "",
    website: "",
    script:
      "Hey! Is this your business? Awesome — I love what you guys are doing! I have a quick idea that could help bring you more customers — got a sec?",
    transcript: [],
  };

  let twiml: string;
  const hasContext = callContexts.has(callSid);
  console.log(`[call/handler] context found=${hasContext} company="${context.companyName}"`);

  if (!speechResult.trim()) {
    // First message — play personalized script
    console.log(`[call/handler] playing initial script (${context.script.length} chars)`);
    const encodedText = encodeURIComponent(context.script);
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${baseUrl}/api/call/audio?text=${encodedText}</Play>
  <Gather input="speech" action="${baseUrl}/api/call/handler" method="POST" speechTimeout="auto" language="en-US" timeout="10" speechModel="deepgram:nova-2" />
  <Say voice="Polly.Matthew">Sorry, I didn't catch that. Let me try again.</Say>
  <Redirect method="POST">${baseUrl}/api/call/handler</Redirect>
</Response>`;
  } else {
    // User responded — generate response + TTS, cache audio, serve instantly
    context.transcript.push({ role: "human", text: speechResult });
    const aiResponse = await getResponse(speechResult, callSid);
    context.transcript.push({ role: "ai", text: aiResponse });

    // Pre-generate and cache audio so /api/call/audio serves instantly
    const audioId = `audio-${callSid}-${Date.now()}`;
    const audioBuffer = await generateTTS(aiResponse);
    audioCache.set(audioId, audioBuffer);
    setTimeout(() => audioCache.delete(audioId), 60000);

    console.log(`[call/handler] user: "${speechResult}" -> ai: "${aiResponse.slice(0, 80)}..." (${audioBuffer.length} bytes cached)`);

    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${baseUrl}/api/call/audio?id=${encodeURIComponent(audioId)}</Play>
  <Gather input="speech" action="${baseUrl}/api/call/handler" method="POST" speechTimeout="auto" language="en-US" timeout="10" speechModel="deepgram:nova-2" />
  <Say voice="Polly.Matthew">Sorry, I didn't catch that.</Say>
  <Redirect method="POST">${baseUrl}/api/call/handler</Redirect>
</Response>`;
  }

  return new NextResponse(twiml, {
    headers: { "Content-Type": "application/xml" },
  });
}
