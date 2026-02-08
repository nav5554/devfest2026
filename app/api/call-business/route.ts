import { NextResponse } from "next/server";
import { placeCall } from "@/lib/caller";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { phoneNumber, companyName, address, category, website, summary } =
    await req.json();

  console.log(`[call-business] calling ${companyName} at ${phoneNumber}`);

  if (!phoneNumber || !companyName) {
    return NextResponse.json(
      { error: "phoneNumber and companyName are required" },
      { status: 400 }
    );
  }

  try {
    const result = await placeCall({
      phoneNumber,
      companyName,
      address,
      category,
      website,
      summary,
    });
    console.log(`[call-business] success, sid=${result.callSid}`);
    return NextResponse.json(result);
  } catch (err) {
    console.error(`[call-business] error:`, err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Call failed",
      },
      { status: 500 }
    );
  }
}
