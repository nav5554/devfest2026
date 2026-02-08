import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import Firecrawl from "@mendable/firecrawl-js";
import type { Business } from "@/lib/types";

export const maxDuration = 60;

const bizSchema = z.object({
  businesses: z.array(
    z.object({
      name: z.string().describe("Clean business name, no numbering or markdown"),
      phone: z.string().describe("Phone in (XXX) XXX-XXXX format, or empty"),
      address: z.string().describe("Street address, or empty"),
      website: z.string().describe("Business website URL (not yellowpages/google), or empty"),
    })
  ),
});

export async function POST(req: Request) {
  const { searchTerm, location } = await req.json();
  console.log(`[search-businesses] searchTerm="${searchTerm}" location="${location}"`);

  if (!searchTerm || !location) {
    return NextResponse.json(
      { error: "searchTerm and location are required" },
      { status: 400 }
    );
  }

  try {
    // Step 1: Gemini decides whether to expand the query
    const queries = await expandQuery(searchTerm, location);
    console.log(`[search-businesses] expanded into ${queries.length} queries: ${queries.map(q => q.term).join(", ")}`);

    // Step 2: Search Exa for each expanded query in parallel
    const allPromises: Promise<Business[]>[] = [
      ...queries.map((q) => searchExa(q.term, q.location)),
    ];

    const allResults = await Promise.all(allPromises);
    const flat = allResults.flat();
    console.log(`[search-businesses] total raw results: ${flat.length}`);

    // Step 3: Merge and deduplicate by normalized name
    const seen = new Set<string>();
    const merged: Business[] = [];

    for (const biz of flat) {
      const key = biz.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!seen.has(key) && key.length > 1) {
        seen.add(key);
        merged.push(biz);
      }
    }

    console.log(`[search-businesses] merged=${merged.length} (deduped)`);

    return NextResponse.json({
      searchTerm,
      location,
      businesses: merged.slice(0, 75),
    });
  } catch (err) {
    console.error(`[search-businesses] error:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }
}

// --- Gemini query expansion ---
async function expandQuery(
  searchTerm: string,
  location: string
): Promise<{ term: string; location: string }[]> {
  try {
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: z.object({
        queries: z.array(
          z.object({
            term: z.string().describe("Search term for YellowPages"),
            location: z.string().describe("Location/city"),
          })
        ),
      }),
      prompt:
        `You are helping a sales team find local businesses to call.\n\n` +
        `The user searched for: "${searchTerm}" in "${location}"\n\n` +
        `If this is already a SPECIFIC search (e.g. "Korean BBQ", "pediatric dentist", "yoga studio"), ` +
        `return ONLY the original query as-is. Do not expand specific searches.\n\n` +
        `If this is a BROAD category (e.g. "restaurants", "doctors", "home services", "shops"), ` +
        `return 3 more specific subcategory variations that would yield different results on YellowPages. ` +
        `Keep the same location.\n\n` +
        `Examples:\n` +
        `- "restaurants" in "NYC" → ["Italian restaurants", "Chinese restaurants", "Mexican restaurants"] in "NYC"\n` +
        `- "doctors" in "LA" → ["family doctors", "dentists", "dermatologists"] in "LA"\n` +
        `- "coffee shops" in "SF" → just ["coffee shops"] in "SF" (already specific enough)\n\n` +
        `Return 1-3 queries. Always include at least the original or a close variant.`,
    });

    if (object.queries.length === 0) {
      return [{ term: searchTerm, location }];
    }

    return object.queries.slice(0, 3);
  } catch (err) {
    console.error("[search-businesses] query expansion error:", err);
    return [{ term: searchTerm, location }];
  }
}

// --- Google web search via Firecrawl SDK ---
const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY ?? "" });

async function searchGoogle(searchTerm: string, location: string): Promise<Business[]> {
  try {
    const response = await firecrawl.search(`${searchTerm} in ${location} phone number address website`, {
      limit: 5,
      scrapeOptions: { formats: ["markdown", "links"] },
    });

    console.log(`[search-businesses] Firecrawl raw response keys:`, Object.keys(response));
    const results = response.web ?? [];
    if (results.length > 0) {
      console.log(`[search-businesses] First result keys:`, Object.keys(results[0]));
      console.log(`[search-businesses] First result has markdown:`, !!(results[0] as any).markdown, `links:`, !!(results[0] as any).links);
      console.log(`[search-businesses] First result url:`, (results[0] as any).url);
    }
    if (!results.length) {
      console.error(`[search-businesses] Google search empty`);
      return [];
    }

    const combined = results
      .map((r: any) => {
        const links = ((r.links ?? []) as string[]).filter((l: string) =>
          !l.includes("yelp.com") && !l.includes("google.com") &&
          !l.includes("facebook.com") && !l.includes("yellowpages.com") &&
          !l.includes("twitter.com") && !l.includes("instagram.com")
        ).slice(0, 20);
        return `Source URL: ${r.url || ""}\nTitle: ${r.title || ""}\n${r.markdown || ""}\n\nLinks found on page:\n${links.join("\n")}`;
      })
      .join("\n\n---\n\n")
      .slice(0, 30000);

    console.log(`[search-businesses] Google search got ${results.length} pages, ${combined.length} chars`);

    return extractBusinesses(combined, searchTerm, location, "Google");
  } catch (err) {
    console.error(`[search-businesses] Google error:`, err);
    return [];
  }
}

// --- Exa company search ---
async function searchExa(searchTerm: string, location: string): Promise<Business[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    console.log("[search-businesses] EXA_API_KEY not set, skipping Exa search");
    return [];
  }

  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query: `${searchTerm} in ${location}`,
        type: "auto",
        category: "company",
        numResults: 20,
        contents: {
          text: { maxCharacters: 3000 },
        },
      }),
    });

    const json = await res.json();
    if (!json.results?.length) {
      console.log("[search-businesses] Exa search returned no results");
      return [];
    }

    const combined = json.results
      .map((r: { title?: string; url?: string; text?: string }) =>
        `${r.title || ""}\n${r.url || ""}\n${r.text || ""}`)
      .join("\n\n---\n\n")
      .slice(0, 30000);

    console.log(`[search-businesses] Exa search got ${json.results.length} results, ${combined.length} chars`);

    return extractBusinesses(combined, searchTerm, location, "Exa");
  } catch (err) {
    console.error("[search-businesses] Exa error:", err);
    return [];
  }
}

// --- Gemini extraction (shared) ---
async function extractBusinesses(
  content: string,
  searchTerm: string,
  location: string,
  source: string
): Promise<Business[]> {
  const truncated = content.slice(0, 30000);

  try {
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: bizSchema,
      prompt:
        `Extract REAL business listings from these ${source} search results.\n\n` +
        `Search was for "${searchTerm}" in "${location}".\n\n` +
        `RULES:\n` +
        `- Only include REAL businesses with actual names (not navigation links, ads, or categories)\n` +
        `- Do NOT invent or fabricate any data. If a field is not in the content, use an empty string.\n` +
        `- Clean up names: remove numbering like "1.", markdown artifacts like "[" or "]", backslashes\n` +
        `- Phone numbers should be in (XXX) XXX-XXXX format\n` +
        `- Do NOT include yellowpages.com, google.com, yelp.com, or other directory URLs as website\n` +
        `- If a "Source URL" is the business's own domain (not a directory/aggregator), use it as the website\n` +
        `- Check "Links found on page" for business websites - match links to businesses by domain name similarity\n` +
        `- Extract ALL businesses listed, not just a few. Get every single one.\n\n` +
        `Content:\n${truncated}`,
    });

    console.log(`[search-businesses] ${source}: extracted ${object.businesses.length} via Gemini`);

    return object.businesses
      .filter((b) => b.name && b.name.length > 1)
      .map((b) => makeBusiness(b, searchTerm, source as Business["source"]));
  } catch (err) {
    console.error(`[search-businesses] ${source} extraction error:`, err);
    return [];
  }
}

function makeBusiness(
  partial: { name: string; phone: string; address: string; website: string },
  category: string,
  source: Business["source"]
): Business {
  return {
    id: crypto.randomUUID(),
    name: partial.name,
    phone: partial.phone,
    address: partial.address,
    website: partial.website,
    category,
    email: "",
    ownerName: "",
    ceoPhone: "",
    about: "",
    enrichmentStatus: "idle" as const,
    callStatus: "idle" as const,
    callSid: "",
    transcript: [],
    source,
  };
}
