import twilio from "twilio";

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

// --- In-memory call context store ---
export const callContexts = new Map<string, CallContext>();

// --- Script generation ---

export function generateScript(
  companyName: string,
  category = "",
  address = "",
  _summary = ""
): string {
  let greeting = `Hi, I'm calling ${companyName}`;

  if (address) {
    const parts = address.split(",");
    if (parts.length > 1) {
      const location = parts[parts.length - 1].trim();
      greeting += ` in ${location}`;
    }
  }

  let categoryContext = "";
  if (category) {
    categoryContext = ` I see you're a ${category.toLowerCase()} business`;
  }

  return (
    `${greeting}.${categoryContext}. ` +
    "I'm reaching out because I think I can really help your business grow and reach more customers. " +
    "Are you free to talk for a quick minute? I'd love to tell you about some options that could really make a difference for your business."
  );
}

// --- Conversational response logic ---

export function getResponse(userInput: string): string {
  const lower = userInput.toLowerCase().trim();

  if (["hello", "hi", "hey", "what's up"].some((w) => lower.includes(w))) {
    return "Hey! Thanks for picking up. I'm calling because I think I can really help your business grow. Are you open to hearing about some upgrade options?";
  }

  if (
    ["yes", "yeah", "sure", "okay", "ok", "yep", "sounds good", "interested"].some(
      (w) => lower.includes(w)
    )
  ) {
    return "Awesome! I'm excited to help you out. So, what kind of business are you running? I'd love to understand what you do so I can tailor the best solution for you.";
  }

  if (
    ["no", "nope", "nah", "not interested", "not right now"].some((w) =>
      lower.includes(w)
    )
  ) {
    return "I totally get it - you're probably busy. No pressure at all. Is there maybe a better time I could reach out? Or if you change your mind, just let me know!";
  }

  if (
    ["cost", "price", "how much", "expensive", "money", "afford"].some((w) =>
      lower.includes(w)
    )
  ) {
    return "I totally understand wanting to know about pricing. The cool thing is we have different options depending on what you need, and honestly, a lot of businesses see it pay for itself pretty quickly. Would you be open to a quick chat where we can go over the numbers?";
  }

  if (
    ["schedule", "call", "meeting", "time", "when", "later", "tomorrow"].some(
      (w) => lower.includes(w)
    )
  ) {
    return "Perfect! I'd love to set something up. What works better for you - are you free later today, or would tomorrow be better?";
  }

  if (
    ["bye", "goodbye", "thanks", "thank you", "gotta go", "have to go"].some(
      (w) => lower.includes(w)
    )
  ) {
    return "Absolutely! Thanks so much for your time today. I really appreciate you hearing me out. Have an amazing day!";
  }

  return "I hear you. I genuinely think we can help your business, and I'd love to show you how. What do you say - want to hear a bit more about what we can do for you?";
}

// --- ElevenLabs TTS ---

export async function generateTTS(text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    throw new Error("ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID are required");
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.75,
          style: 0.3,
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
