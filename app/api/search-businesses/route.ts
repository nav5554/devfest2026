import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import type { Business } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { searchTerm, location } = await req.json();
  console.log(
    `[search-businesses] searchTerm="${searchTerm}" location="${location}"`
  );

  if (!searchTerm || !location) {
    return NextResponse.json(
      { error: "searchTerm and location are required" },
      { status: 400 }
    );
  }

  const ypUrl = `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(searchTerm)}&geo_location_terms=${encodeURIComponent(location)}`;

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url: ypUrl,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    const json = await res.json();
    if (!json.success) {
      console.error(`[search-businesses] scrape failed:`, json.error);
      return NextResponse.json({
        error: json.error || "Failed to search YellowPages",
      });
    }

    const markdown: string = json.data?.markdown ?? "";
    console.log(`[search-businesses] got ${markdown.length} chars of markdown`);

    // Use Gemini to extract clean structured data from the scraped markdown
    const businesses = await extractBusinessesWithGemini(
      markdown,
      searchTerm,
      location
    );
    console.log(`[search-businesses] extracted ${businesses.length} businesses`);

    return NextResponse.json({
      searchTerm,
      location,
      businesses: businesses.slice(0, 50),
    });
  } catch (err) {
    console.error(`[search-businesses] error:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }
}

async function extractBusinessesWithGemini(
  markdown: string,
  searchTerm: string,
  location: string
): Promise<Business[]> {
  const truncated = markdown.slice(0, 30000);

  try {
    const { object } = await generateObject({
      model: google("gemini-2.5-pro"),
      schema: z.object({
        businesses: z.array(
          z.object({
            name: z.string().describe("Clean business name, no numbering or markdown"),
            phone: z.string().describe("Phone in (XXX) XXX-XXXX format, or empty"),
            address: z.string().describe("Street address, or empty"),
            website: z.string().describe("Business website URL (not yellowpages), or empty"),
          })
        ),
      }),
      prompt:
        `Extract REAL business listings from this YellowPages search results page.\n\n` +
        `Search was for "${searchTerm}" in "${location}".\n\n` +
        `RULES:\n` +
        `- Only include REAL businesses with actual names (not navigation links, ads, or categories)\n` +
        `- Do NOT invent or fabricate any data. If a field is not in the content, use an empty string.\n` +
        `- Clean up names: remove numbering like "1.", markdown artifacts like "[" or "]", backslashes\n` +
        `- Phone numbers should be in (XXX) XXX-XXXX format\n` +
        `- Do NOT include yellowpages.com URLs as website\n` +
        `- Extract ALL businesses listed, not just a few. Get every single one.\n\n` +
        `Content:\n${truncated}`,
    });

    console.log(`[search-businesses] extracted ${object.businesses.length} businesses via AI SDK`);

    return object.businesses
      .filter((b) => b.name && b.name.length > 1)
      .map((b) => ({
        id: crypto.randomUUID(),
        name: b.name,
        phone: b.phone,
        address: b.address,
        website: b.website,
        category: searchTerm,
        email: "",
        ownerName: "",
        ceoPhone: "",
        about: "",
        enrichmentStatus: "idle" as const,
        callStatus: "idle" as const,
        callSid: "",
        transcript: [],
      }));
  } catch (err) {
    console.error("[search-businesses] AI SDK extraction error:", err);
    return [];
  }
}
