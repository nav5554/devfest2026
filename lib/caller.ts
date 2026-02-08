import twilio from "twilio";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

// --- Types ---

export interface CallRequest {
  phoneNumber: string;
  companyName: string;
  address?: string;
  category?: string;
  website?: string;
  summary?: string;
}

export interface CallContext {
  companyName: string;
  category: string;
  address: string;
  summary: string;
  website: string;
  script: string;
  transcript: { role: "ai" | "human"; text: string }[];
}

// --- In-memory stores (survive Next.js hot reloads) ---
const globalForCaller = globalThis as unknown as {
  callContexts: Map<string, CallContext>;
  audioCache: Map<string, Buffer>;
};
globalForCaller.callContexts ??= new Map<string, CallContext>();
globalForCaller.audioCache ??= new Map<string, Buffer>();

export const callContexts = globalForCaller.callContexts;
export const audioCache = globalForCaller.audioCache;

// --- Script generation ---

export function generateScript(
  companyName: string,
  category = "",
  address = "",
  _summary = ""
): string {
  // Build location snippet from address (last part, e.g. "Brooklyn")
  let location = "";
  if (address) {
    const parts = address.split(",");
    if (parts.length > 1) {
      location = parts[parts.length - 1].trim();
    }
  }

  // Short, punchy, personalized opener
  let script = `Hey! Is this ${companyName}?`;

  if (location && category) {
    script += ` I came across your ${category.toLowerCase()} spot in ${location} and I love what you guys are doing!`;
  } else if (category) {
    script += ` I came across your ${category.toLowerCase()} spot and I love what you guys are doing!`;
  } else if (location) {
    script += ` I came across your business in ${location} and I love what you guys are doing!`;
  } else {
    script += ` I came across your business and I love what you guys are doing!`;
  }

  script += ` I have a quick idea that could help bring you more customers — got a sec?`;

  return script;
}

// --- AI-powered conversational response ---

export async function getResponse(userInput: string, callSid?: string): Promise<string> {
  const context = callSid ? callContexts.get(callSid) : undefined;

  const convoHistory = context?.transcript
    ?.map((t) => `${t.role === "ai" ? "You" : "Them"}: ${t.text}`)
    .join("\n") ?? "";

  const companyInfo = context
    ? `You are calling ${context.companyName}${context.category ? `, a ${context.category} business` : ""}${context.address ? ` located at ${context.address}` : ""}.`
    : "You are calling a local business.";

  try {
    const { text } = await generateText({
      model: google("gemini-2.0-flash"),
      prompt: `Sales call. ${companyInfo}
Goal: book a 15-min call this week. Be warm but direct — get to the ask fast.
ONE sentence max. Sound human, not scripted.
If they seem even slightly open, immediately suggest that they will be contacted by a sales representative soon.
If they say yes/sure/okay, confirm and wrap up fast. When you wrap up say have a good one and hang up. 

${convoHistory ? `Chat:\n${convoHistory}\n` : ""}Them: "${userInput}"
You:`,
    });

    return text.trim();
  } catch (err) {
    console.error("[caller] AI response error:", err);
    return "That's great to hear! I'd love to tell you more about how we can help. Do you have a minute?";
  }
}

// --- ElevenLabs TTS ---

export async function generateTTS(text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    throw new Error("ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID are required");
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=4&output_format=mp3_22050_32`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_flash_v2_5",
        voice_settings: {
          stability: 0.65,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ElevenLabs API error: ${errorText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// --- Place call via Twilio ---

export async function placeCall(request: CallRequest): Promise<{
  success: boolean;
  callSid: string;
  toNumber: string;
  companyName: string;
  testMode: boolean;
}> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const testPhoneNumber = process.env.TEST_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are required"
    );
  }

  const client = twilio(accountSid, authToken);
  console.log(`[caller] baseUrl=${baseUrl} testPhone=${testPhoneNumber ?? "none"}`);

  // Use test number if set
  let phoneToUse = (testPhoneNumber || request.phoneNumber).trim();
  if (!phoneToUse.startsWith("+")) {
    phoneToUse = phoneToUse.replace(/\D/g, "");
    phoneToUse =
      phoneToUse.length === 10 ? `+1${phoneToUse}` : `+${phoneToUse}`;
  }

  // Generate personalized script
  const script = generateScript(
    request.companyName,
    request.category,
    request.address,
    request.summary
  );

  // Place the call
  console.log(`[caller] calling ${phoneToUse} from ${fromNumber}, webhook=${baseUrl}/api/call/handler`);
  const call = await client.calls.create({
    to: phoneToUse,
    from: fromNumber,
    url: `${baseUrl}/api/call/handler`,
    method: "POST",
  });
  console.log(`[caller] call created, sid=${call.sid}`);

  // Store context for the webhook handler
  callContexts.set(call.sid, {
    companyName: request.companyName,
    category: request.category || "",
    address: request.address || "",
    summary: request.summary || "",
    website: request.website || "",
    script,
    transcript: [{ role: "ai", text: script }],
  });

  return {
    success: true,
    callSid: call.sid,
    toNumber: phoneToUse,
    companyName: request.companyName,
    testMode: !!testPhoneNumber,
  };
}
