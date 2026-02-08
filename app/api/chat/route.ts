import {
  streamText,
  UIMessage,
  convertToModelMessages,
  tool,
  stepCountIs,
} from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { executeCommand } from "@/lib/stagehand";
import { placeCall } from "@/lib/caller";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  console.log(`[chat] POST with ${messages.length} messages`);

  const result = streamText({
    model: google("gemini-2.5-flash"),
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    system:
      "You are an autonomous AI sales assistant. You execute the user's goal end-to-end WITHOUT asking follow-up questions.\n\n" +
      "TOOLS:\n" +
      "1. **find_businesses** - Find local businesses by type and location\n" +
      "2. **call_business** - Place a voice call to a business\n" +
      "3. **browser** - Control a live browser (navigate, click, fill forms)\n" +
      "4. **search** - Search the web for information\n" +
      "5. **scrape** - Read content from a URL\n\n" +
      "AUTONOMOUS BEHAVIOR:\n" +
      "- When the user gives a goal like 'call plumbers in NYC', you IMMEDIATELY:\n" +
      "  1. Use find_businesses to find them\n" +
      "  2. Pick the first result with a phone number\n" +
      "  3. Use call_business to call them\n" +
      "  4. Report the result\n" +
      "- When the user says 'find X in Y and call them', do ALL steps automatically.\n" +
      "- When the user says 'go to website and do X', use browser immediately.\n" +
      "- NEVER ask 'would you like me to...?' or 'shall I...?' - just DO IT.\n" +
      "- NEVER ask for confirmation between steps. Chain tools together.\n" +
      "- If find_businesses returns results, automatically call the first one with a phone number.\n" +
      "- Only stop to report the final outcome.\n" +
      "- For regular questions with no action needed, just answer normally.",
    tools: {
      browser: tool({
        description:
          "Control a web browser to perform actions like navigating to websites, " +
          "searching, clicking buttons, filling forms, and extracting information from pages. " +
          "Pass natural language instructions describing what to do.",
        inputSchema: z.object({
          instruction: z
            .string()
            .describe(
              "Natural language instruction for the browser, e.g. 'go to google.com and search for AI'"
            ),
        }),
        async *execute({ instruction }) {
          console.log(`[browser] execute: "${instruction}"`);
          const updates: string[] = [];
          let debugUrl = "";

          // Yield preliminary results as status updates stream in
          const promise = executeCommand(instruction, (event) => {
            updates.push(`[${event.type}] ${event.message}`);
            if (event.debugUrl) debugUrl = event.debugUrl;
          });

          // Poll for updates while command executes
          const done = { value: false };
          promise.then(() => { done.value = true; });

          while (!done.value) {
            await new Promise((r) => setTimeout(r, 1000));
            yield {
              status: "running" as const,
              log: [...updates],
              debugUrl,
              summary: updates[updates.length - 1] || "Starting...",
            };
          }

          // Ensure promise errors propagate
          await promise;

          // Final result
          yield {
            status: "complete" as const,
            log: updates,
            debugUrl,
            summary: updates[updates.length - 1] || "Command executed.",
          };
        },
      }),
      scrape: tool({
        description:
          "Scrape and read the content of a web page given its URL. " +
          "Returns the page content as markdown. Use this to read articles, documentation, " +
          "or extract information from a specific URL.",
        inputSchema: z.object({
          url: z.string().url().describe("The URL to scrape"),
          onlyMainContent: z
            .boolean()
            .optional()
            .default(true)
            .describe("Extract only the main content, removing nav/footer/ads"),
        }),
        execute: async ({ url, onlyMainContent }) => {
          console.log(`[scrape] url=${url} onlyMainContent=${onlyMainContent}`);
          const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
            },
            body: JSON.stringify({
              url,
              formats: ["markdown"],
              onlyMainContent,
            }),
          });
          const json = await res.json();
          if (!json.success) {
            console.error(`[scrape] failed:`, json.error);
            return { error: json.error || "Failed to scrape URL" };
          }
          const markdown = json.data?.markdown ?? "";
          console.log(`[scrape] got ${markdown.length} chars from ${url}`);
          // Truncate if too long for context
          const truncated =
            markdown.length > 15000
              ? markdown.slice(0, 15000) + "\n\n[...truncated]"
              : markdown;
          return {
            url,
            title: json.data?.metadata?.title ?? "",
            content: truncated,
          };
        },
      }),
      search: tool({
        description:
          "Search the web for information. Returns a list of results with titles, URLs, and content snippets. " +
          "Use this when the user asks a question that requires up-to-date web information, " +
          "or wants to find pages about a topic.",
        inputSchema: z.object({
          query: z.string().describe("The search query"),
          limit: z
            .number()
            .optional()
            .default(5)
            .describe("Number of results to return (default 5)"),
        }),
        execute: async ({ query, limit }) => {
          console.log(`[search] query="${query}" limit=${limit}`);
          const res = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
            },
            body: JSON.stringify({
              query,
              limit,
              scrapeOptions: { formats: ["markdown"] },
            }),
          });
          const json = await res.json();
          if (!json.success) {
            console.error(`[search] failed:`, json.error);
            return { error: json.error || "Search failed" };
          }
          console.log(`[search] got ${(json.data ?? []).length} results`);
          const results = (json.data ?? []).map(
            (r: { url?: string; title?: string; markdown?: string }) => ({
              url: r.url ?? "",
              title: r.title ?? "",
              snippet:
                (r.markdown ?? "").slice(0, 500) +
                ((r.markdown ?? "").length > 500 ? "..." : ""),
            })
          );
          return { query, results };
        },
      }),
      find_businesses: tool({
        description:
          "Find local businesses by type and location using YellowPages. " +
          "Returns a list of businesses with name, phone, address, website, and category. " +
          "Use this when the user wants to find local businesses or services.",
        inputSchema: z.object({
          searchTerm: z
            .string()
            .describe("Type of business (e.g. 'coffee shops', 'plumbers', 'dentists')"),
          location: z
            .string()
            .describe("City and state (e.g. 'New York, NY', 'San Francisco, CA')"),
        }),
        execute: async ({ searchTerm, location }) => {
          console.log(`[find_businesses] searchTerm="${searchTerm}" location="${location}"`);
          const ypUrl = `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(searchTerm)}&geo_location_terms=${encodeURIComponent(location)}`;
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
            console.error(`[find_businesses] scrape failed:`, json.error);
            return { error: json.error || "Failed to search YellowPages" };
          }
          const markdown: string = json.data?.markdown ?? "";
          console.log(`[find_businesses] got ${markdown.length} chars of markdown`);
          // Parse business listings from YellowPages markdown
          const businesses: {
            name: string;
            phone: string;
            address: string;
            website: string;
            category: string;
          }[] = [];
          // YellowPages listings typically have patterns like:
          // ## Business Name\n...(###) ###-####...address...
          const lines = markdown.split("\n");
          let current: { name: string; phone: string; address: string; website: string; category: string } | null = null;
          for (const line of lines) {
            const nameMatch = line.match(/^#{1,3}\s+\[?([^\]#]+)\]?/);
            if (nameMatch && nameMatch[1].trim().length > 2) {
              if (current && current.name) businesses.push(current);
              current = { name: nameMatch[1].trim(), phone: "", address: "", website: "", category: searchTerm };
            }
            if (current) {
              const phoneMatch = line.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
              if (phoneMatch && !current.phone) current.phone = phoneMatch[0];
              const urlMatch = line.match(/https?:\/\/[^\s)]+/);
              if (urlMatch && !urlMatch[0].includes("yellowpages") && !current.website)
                current.website = urlMatch[0];
              if (line.match(/\d+\s+\w+\s+(St|Ave|Blvd|Rd|Dr|Ln|Way|Ct|Pl)/i) && !current.address)
                current.address = line.trim().slice(0, 100);
            }
          }
          if (current && current.name) businesses.push(current);
          console.log(`[find_businesses] parsed ${businesses.length} businesses`);
          return { searchTerm, location, businesses: businesses.slice(0, 15) };
        },
      }),
      call_business: tool({
        description:
          "Place a voice call to a business using their phone number. " +
          "The call uses AI-generated speech (ElevenLabs) and can have a conversation. " +
          "Requires Twilio and ElevenLabs to be configured.",
        inputSchema: z.object({
          phoneNumber: z.string().describe("Phone number to call"),
          companyName: z.string().describe("Name of the business"),
          address: z.string().optional().describe("Business address"),
          category: z.string().optional().describe("Business category"),
          website: z.string().optional().describe("Business website"),
          summary: z.string().optional().describe("Brief summary about the business"),
        }),
        execute: async ({ phoneNumber, companyName, address, category, website, summary }) => {
          console.log(`[call_business] calling ${companyName} at ${phoneNumber}`);
          try {
            const result = await placeCall({
              phoneNumber,
              companyName,
              address,
              category,
              website,
              summary,
            });
            return result;
          } catch (err) {
            console.error(`[call_business] error:`, err);
            return {
              success: false,
              error: err instanceof Error ? err.message : "Call failed",
            };
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
